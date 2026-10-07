---
name: status
description: Say whether the Jared service is running, since when, and when it ends by itself, when the user asks whether the Jared server or service is running, or what state it is in. It starts nothing, stops nothing and reviews nothing.
allowed-tools:
  - Bash(jared-link --status)
---

# Say the state of the Jared service

Run `jared-link --status` with the Bash tool and tell the user what it printed: either "No Jared service is running.", or where it runs (a port and a process), when it started and how long ago, and when it ends by itself.

The Jared service is the small program on this computer that serves Jared to a browser tool (`/jared:review`, the serve way). It is started by the first review and used by every later one, and it ends by itself after half an hour without a request. Asking for its state is a request like any other, so it puts that end off; it does not start the service or stop it (`/jared:stop` stops it). A Jared that you run yourself, for example from a development server, is not this service.
