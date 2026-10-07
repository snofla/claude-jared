---
name: stop
description: Stop the Jared service that the review skill started, when the user asks to stop or kill the Jared server or service. It does not review anything and touches no receiver or dev server.
allowed-tools:
  - Bash(jared-link --stop)
---

# Stop the Jared service

Run `jared-link --stop` with the Bash tool and tell the user what it printed: that it stopped the Jared service, and for how long it had run, or "No Jared service is running."

The Jared service is the small program on this computer that serves Jared to a browser tool (`/jared:review`, the serve way). It is started by the first review and used by every later one, and it ends by itself after half an hour without a request, so this only stops it earlier. A Jared that you run yourself, for example from a development server, is not this service, and nothing but this service is stopped.
