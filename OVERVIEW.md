Sidebar view that groups workspaces by project and adds a Name option to the sort order.

Paseo itself always lists projects alphabetically, but the sidebar's Sort menu only offers Manual, Created, and Last prompted, all of which describe a workspace rather than a name. This view keeps the project grouping and adds Name, so workspaces inside a project are listed A to Z by the name shown on the row: the custom title when the workspace has one, its branch name otherwise.

Projects stay alphabetical by project name under Name, and follow their first workspace under Created and Last prompted, so the order is visible even when a project holds a single workspace. Workspaces are grouped under their project, pinned workspaces sit in a Pinned section above, and the rows use the same density as the built-in sidebar. Background workspaces stay hidden until the display preferences show them, as in the built-in sidebar. Clicking a project row collapses or expands it, its trailing button opens the new-workspace screen for that project, and its menu opens the project settings or removes the project after a confirmation, the same way the built-in sidebar does. The settings entry drives the app's own route, which only exists in the desktop client.

Every workspace row has an actions menu with New workspace, Copy path, Copy branch name, Rename workspace, Pin to top or Unpin, and Archive. The button is always visible on touch, and appears on hover or keyboard focus on desktop. The menu itself opens as a floating card beside the row, like the built-in flyouts, and closes on the next click outside it. Renaming to an empty name clears the custom title and the row falls back to the branch name.

Pick the view in Settings, Sidebar, Sidebar view. The button at the right of the Workspaces header opens the same display preferences the built-in sidebar shows, as a floating card; a row with options replaces the card's content and its header row leads back:

- Grouping: Project or Status.
- Sort: Name, Created, or Last prompted. Contributed by this plugin; Name orders the rows by the title or the branch, whichever the Title setting shows.
- Title: the custom title or the branch name.
- Show: whether a row carries the branch, the project, the host, and the labels, plus a trailing diff or timestamp.
- Host and Project: narrow the list, several at a time, marked with a dot while active. The host page lists only the hosts that are online.
- Show background: includes the workspaces hidden from the sidebar.

Created and Last prompted also reorder the project groups, which the built-in sidebar never does. Everything is stored on the device, so each client keeps its own layout. Paseo 0.16.0 or newer is required.

A plugin reaches the host through Paseo's plugin API, which owns the workspace list but not everything on it, so this view cannot do all the built-in sidebar does. Missing: manual drag order, drag and drop, the change-request and services row lines, the checks display, the label filter, and the Undo action in the archive toast. Projects with no visible workspace are hidden, and pinned workspaces move to the Pinned section instead of also appearing under their project.
