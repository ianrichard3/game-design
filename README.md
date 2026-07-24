![microStudio](static/img/microstudio_title_image.png)

# microStudio local

microStudio local is a single-user game engine that runs entirely on your
computer. Create a project, edit microScript 2 and assets in the browser (or in
a linked local folder), and run it with live reload.

It intentionally has no accounts, cloud hosting, collaboration, community
features, or alternate language/graphics runtimes. Each installation owns one
local workspace and uses the M1 graphics API with microScript 2.

## Run it

Install a current Node.js LTS release, then from this repository:

```sh
cd server
npm install
npm start
```

Open [http://127.0.0.1:8089](http://127.0.0.1:8089). The first launch creates
the local `microstudio` user automatically; there is no login screen.

For development, use `npm run dev`. It compiles CoffeeScript once, watches the
source files, and starts the local server.

## Optional configuration

Create `config.json` at the repository root only when you need to change the
local port or constrain which folders may be linked to projects:

```json
{
  "port": 8090,
  "projects_root": "/absolute/path/to/your/projects"
}
```

`projects_root` is optional. When set, a linked project folder must be inside
that directory. Project data otherwise lives locally under `data/` and `files/`.

## Workflow

1. Create a project in the browser.
2. Use **Settings → Local folder** to link it to a local Git repository if you
   want to edit files with another tool.
3. Keep microStudio open to see folder changes and run the project.
4. Use the **Git** tab for status, commits, pulls, and pushes.
5. Use **Settings → Export to HTML5** to create a standalone web export.

The repository retains the original microStudio MIT license in `LICENSE.txt`.
