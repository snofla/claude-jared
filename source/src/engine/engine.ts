import type { Review } from '../types.ts'
import { diffOf, inOneFile } from '../lib/diff.ts'
import { reviewFileName, toJson, toMarkdown } from '../lib/export.ts'
import { LANGUAGE_OPTIONS } from '../lib/language.ts'
import { newReview, upsertComment } from '../lib/review.ts'
import { prepareSource } from '../lib/source.ts'
import {
  errorReply,
  parseRequest,
  PROTOCOL_VERSION,
  type ErrorCode,
  type ExportRequest,
  type Reply,
  type Request,
  type SessionReply,
  type SourceReply,
  type SubmitOptions,
} from './protocol.ts'

/**
 * Everything the engine knows: the open file's text and the review of it. Plain data that can be kept anywhere,
 * for example as JSON between two requests, so the engine itself holds nothing between calls.
 */
export interface EngineState {
  source: { name: string; content: string; language: string; hash: string; submitLabel?: string; submitTarget?: string; submitOptions?: SubmitOptions } | null
  review: Review | null
}

export const emptyEngineState: EngineState = { source: null, review: null }

export interface Outcome {
  state: EngineState
  replies: Reply[]
}

const linesOf = (content: string): string[] => content.split('\n')

/** Whether a review that is for this very text also has only lines that the text has. */
const reviewFits = (review: Review, lineCount: number): boolean =>
  review.file.lineCount === lineCount && !review.comments.some((c) => c.endLine > lineCount)

function session(state: EngineState, replyTo: string): SessionReply {
  const { source, review } = state
  return {
    protocol: PROTOCOL_VERSION,
    replyTo,
    type: 'session',
    file: source && review ? { name: source.name, language: source.language, lineCount: review.file.lineCount, hash: source.hash } : null,
    review,
  }
}

function refuse(state: EngineState, request: { id: string }, code: ErrorCode, message: string): Outcome {
  return { state, replies: [errorReply(request.id, code, message)] }
}

function answer(state: EngineState, request: { id: string }): Outcome {
  return { state, replies: [session(state, request.id)] }
}

function doExport(state: EngineState, request: ExportRequest): Outcome {
  const { review } = state
  if (!review) return refuse(state, request, 'no-session', 'export: no file is open.')
  const markdown = request.format === 'markdown'
  return {
    state,
    replies: [
      {
        protocol: PROTOCOL_VERSION,
        replyTo: request.id,
        type: 'exported',
        format: request.format,
        fileName: reviewFileName(review, markdown ? 'md' : 'json'),
        mime: markdown ? 'text/markdown' : 'application/json',
        text: markdown ? toMarkdown(review) : toJson(review),
      },
    ],
  }
}

/** Act on one request. Pure: the new state and the replies depend on the old state and the request, and on nothing else. */
export function handle(state: EngineState, request: Request): Outcome {
  const { source, review } = state

  switch (request.type) {
    case 'open': {
      const prepared = prepareSource(request.name, request.text)
      if (!prepared.ok) return refuse(state, request, 'file-rejected', prepared.error)
      const file = prepared.file
      let restored = request.review
      if (restored) {
        if (restored.file.hash !== file.hash) {
          return refuse(state, request, 'review-mismatch', `open: the review is for another file or another version of "${restored.file.name}".`)
        }
        if (!reviewFits(restored, file.lines.length)) {
          return refuse(state, request, 'invalid-review', 'open: the review has lines that the file does not have.')
        }
      } else {
        restored = newReview(file, request.now)
      }
      // A restored review keeps the language its reviewer chose, as the app does when it reopens a file.
      const delivery = {
        ...(request.submitLabel === undefined ? {} : { submitLabel: request.submitLabel }),
        ...(request.submitTarget === undefined ? {} : { submitTarget: request.submitTarget }),
        ...(request.submitOptions === undefined ? {} : { submitOptions: request.submitOptions }),
      }
      return answer({ source: { name: file.name, content: file.content, language: restored.file.language, hash: file.hash, ...delivery }, review: restored }, request)
    }

    case 'close':
      return answer(emptyEngineState, request)

    case 'getSession':
      return answer(state, request)

    case 'getSource': {
      if (!source || !review) return refuse(state, request, 'no-session', 'getSource: no file is open.')
      const reply: SourceReply = {
        protocol: PROTOCOL_VERSION,
        replyTo: request.id,
        type: 'source',
        file: { name: source.name, language: source.language, lineCount: review.file.lineCount, hash: source.hash },
        text: source.content,
        ...(source.submitLabel === undefined ? {} : { submitLabel: source.submitLabel }),
        ...(source.submitTarget === undefined ? {} : { submitTarget: source.submitTarget }),
        ...(source.submitOptions === undefined ? {} : { submitOptions: source.submitOptions }),
      }
      return { state, replies: [reply] }
    }

    case 'setLanguage': {
      if (!source || !review) return refuse(state, request, 'no-session', 'setLanguage: no file is open.')
      if (!LANGUAGE_OPTIONS.some((option) => option.id === request.language)) {
        return refuse(state, request, 'bad-language', `setLanguage: "${request.language}" is not a language this engine knows.`)
      }
      return answer(
        { source: { ...source, language: request.language }, review: { ...review, file: { ...review.file, language: request.language } } },
        request,
      )
    }

    case 'saveComment': {
      if (!source || !review) return refuse(state, request, 'no-session', 'saveComment: no file is open.')
      if (request.endLine < request.startLine || request.endLine > review.file.lineCount) {
        return refuse(state, request, 'bad-range', `saveComment: lines ${request.startLine} to ${request.endLine} are not inside the file's ${review.file.lineCount} lines.`)
      }
      const lines = linesOf(source.content)
      const diff = diffOf(review.file.language, lines)
      if (diff && !inOneFile(diff, request.startLine, request.endLine)) {
        return refuse(state, request, 'bad-range', `saveComment: lines ${request.startLine} to ${request.endLine} are in more than one file of the diff, and a comment is about one file.`)
      }
      const next = upsertComment(
        review,
        lines,
        { id: request.commentId, startLine: request.startLine, endLine: request.endLine, comment: request.comment, suggestion: request.suggestion },
        request.now,
      )
      if (!next) return refuse(state, request, 'empty-comment', 'saveComment: a comment needs words, or a suggestion that differs from the code.')
      return answer({ source, review: next }, request)
    }

    case 'deleteComment': {
      if (!source || !review) return refuse(state, request, 'no-session', 'deleteComment: no file is open.')
      if (!review.comments.some((c) => c.id === request.commentId)) {
        return refuse(state, request, 'no-such-comment', `deleteComment: there is no comment "${request.commentId}".`)
      }
      const comments = review.comments.filter((c) => c.id !== request.commentId)
      return answer({ source, review: { ...review, comments, updatedAt: request.now } }, request)
    }

    case 'setSummary':
      if (!source || !review) return refuse(state, request, 'no-session', 'setSummary: no file is open.')
      return answer({ source, review: { ...review, summary: request.summary, updatedAt: request.now } }, request)

    case 'markSubmitted':
      if (!source || !review) return refuse(state, request, 'no-session', 'markSubmitted: no file is open.')
      return answer({ source, review: { ...review, submittedAt: request.now } }, request)

    case 'submit': {
      if (!source || !review) return refuse(state, request, 'no-session', 'submit: no file is open.')
      const given = request.review
      if (given.file.hash !== source.hash) {
        return refuse(state, request, 'review-mismatch', `submit: the review is not for the open file "${source.name}", but for another file or another version of it.`)
      }
      if (!reviewFits(given, review.file.lineCount)) {
        return refuse(state, request, 'invalid-review', 'submit: the review has lines that the file does not have.')
      }
      // The review is kept as its reviewer wrote it, language included; only the moment of delivery is added.
      return answer({ source: { ...source, language: given.file.language }, review: { ...given, submittedAt: request.now } }, request)
    }

    case 'export':
      return doExport(state, request)
  }
}

/** Check a value that arrived from outside, then act on it. A bad message gets an error reply and changes nothing. */
export function handleMessage(state: EngineState, value: unknown): Outcome {
  const parsed = parseRequest(value)
  return parsed.ok ? handle(state, parsed.request) : { state, replies: [parsed.reply] }
}

export interface Engine {
  handleMessage(value: unknown): Reply[]
  getState(): EngineState
}

/** An engine that keeps its own state, for a peer that is a long-lived process: a pipe, a socket, a WebAssembly instance. */
export function createEngine(initial: EngineState = emptyEngineState): Engine {
  let state = initial
  return {
    handleMessage(value) {
      const outcome = handleMessage(state, value)
      state = outcome.state
      return outcome.replies
    },
    getState: () => state,
  }
}
