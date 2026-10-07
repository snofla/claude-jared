import { JARED_VERSION } from '../lib/version'

/** The version of Jared that this page is: the `version` in `package.json` in a build, and "dev" on the dev server. It is drawn small and quiet beside the name. */
export function Version() {
  return <span className="version">{JARED_VERSION}</span>
}
