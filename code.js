const frameTitle = "Progressbar";

const params = {
  existing: false,
  progress: 50,
  total: 100
};

// Looking for selected frame
const selected = figma.currentPage.selection[0];

if (typeof selected === "object") {
  const title = selected.name;
  const regex = /(\bProgressbar\b)\s\[(.*?)\]/;
  const exists = title.match(regex);

  // If it has name like Progressbar [0:100]
  if (exists !== null) {
    params.existing = true;

    const values = exists[2].split(":");
    params.progress = parseInt(values[0]);
    params.total = parseInt(values[1]);
  }
}

// Showing UI
figma.showUI(__html__);
figma.ui.postMessage(params);

// Getting data from UI
figma.ui.onmessage = message => {
  const result = message;
  figma.ui.hide();

  if (result.existing) {
    // If frame exists
    const progressbar = selected;
    const progress = selected["children"][0];

    progress.resize(
      progressbar.width * (result.progress / result.total),
      progress.height
    );

    progressbar.name =
      frameTitle + " [" + result.progress + ":" + result.total + "]";
  } else {
    // Creating new progress bar
    const defaultWidth = 200;
    const defaultHeight = 2;

    // Creating progress
    const progress = figma.createRectangle();
    progress.resize(
      (defaultWidth * result.progress) / result.total,
      defaultHeight
    );
    progress.cornerRadius = defaultHeight / 2;
    progress.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.6, b: 0.98 } }];

    // Creating progressbar
    const frame = figma.createFrame();
    frame.resizeWithoutConstraints(defaultWidth, defaultHeight);
    frame.cornerRadius = defaultHeight / 2;
    frame.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.9, b: 1 } }];

    // Center the progressbar
    frame.x = figma.viewport.center.x - defaultWidth / 2;
    frame.y = figma.viewport.center.y - defaultHeight / 2;

    frame.name = frameTitle + " [" + result.progress + ":" + result.total + "]";

    frame.appendChild(progress);
  }

  figma.closePlugin();
};
