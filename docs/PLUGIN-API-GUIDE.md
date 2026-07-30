# Build 40 Plugin API

A plugin manifest requires an ID, semantic version, API version `1.0`, minimum host version where needed, and declared permissions.

Supported permissions:
`score.read`, `selection.read`, `score.mutate`, `analysis.run`, `import.read`, `export.write`, `settings.read`, `settings.write`, and `commands.register`.

Score and selection reads are cloned. Mutations must be named engine commands and are revalidated by the host. A plugin receives no unrestricted Node, filesystem, shell or process object. Failures are isolated and logged. Plugins can be disabled and safely uninstalled with private settings removed.
