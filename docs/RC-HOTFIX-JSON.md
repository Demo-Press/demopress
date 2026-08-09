# DemoPress 1.0-RC JSON / leading-byte hotfix

A packaging bug prefixed four generated files with a literal backslash followed by
a newline. In the DemoPress Agent this caused WordPress REST responses to begin
with `\` before the JSON body, producing `Unexpected token '\'`.

Corrected files:
- demo/wp-content/plugins/demopress-agent/demopress-agent.php
- demo/wp-content/mu-plugins/00-lockdown.php
- demo/setup/personalise.php
- demo/setup/finalise-clone.sh

The corrected PHP files start exactly with `<?php`.
The corrected shell finaliser starts exactly with `#!/bin/bash`.
