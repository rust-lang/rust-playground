## Configuration

In production, these should be set according to your deployment method
of choice.

| Key                       | Required | Default Value   | Description                                                             |
| --------------------------|----------|-----------------|-------------------------------------------------------------------------|
| `PLAYGROUND_UI_ROOT`      | **Yes**  |                 | The path to the HTML, CSS, and Javascript files                         |
| `PLAYGROUND_GITHUB_TOKEN` | **Yes**  |                 | The [GitHub API token][gist] to read and write Gists                    |
| `PLAYGROUND_UI_ADDRESS`   | No       |       127.0.0.1 | The address to listen on                                                |
| `PLAYGROUND_UI_PORT`      | No       |            5000 | The port to listen on                                                   |
| `PLAYGROUND_LOG_FILE`     | No       |  access-log.csv | The file to record accesses                                             |
| `TMPDIR`                  | No       | system-provided | Where compilation artifacts will be saved. Must be accessible to Docker |

[gist]: https://developer.github.com/v3/gists/#authentication
