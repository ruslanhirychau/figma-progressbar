const frameTitle = "Progressbar";

const params = {
  existing: false,
  progress: 50,
  total: 100,
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
figma.showUI(__html__, { width: 300, height: 140 });

figma.ui.postMessage(params);

// Getting data from UI
figma.ui.onmessage = (message) => {
  const result = message;
  figma.ui.hide();

  if (result.existing) {
    // Progressbar exising
    const progressbar = selected;
    const progress = selected["children"][0];

    if (result.progress > 0) {
      progress.visible = true;

      progress.resize(
        progressbar.width * (result.progress / result.total),
        progress.height
      );
    } else {
      progress.visible = false;
    }

    progressbar.name =
      frameTitle + " [" + result.progress + ":" + result.total + "]";
  } else {
    // Creating new progress bar
    const defaultWidth = 200;
    const defaultHeight = 8;
    const defaultBorder = 2;

    // Creating progressbar
    const progress = figma.createRectangle();
    progress.resize(
      (defaultWidth * result.progress) / result.total,
      defaultHeight - defaultBorder * 2
    );
    progress.cornerRadius = defaultHeight / 2;
    progress.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]; // https://www.easyrgb.com/en/convert.php
    progress.x = defaultBorder;
    progress.y = defaultBorder;

    // Creating progressbar container
    const frame = figma.createFrame();
    frame.resizeWithoutConstraints(defaultWidth, defaultHeight);
    frame.cornerRadius = defaultHeight / 2;
    frame.fills = [{ type: "SOLID", color: { r: 0, g: 0.84314, b: 0.63922 } }]; // https://www.easyrgb.com/en/convert.php

    // Center the progressbar
    frame.x = parseInt(figma.viewport.center.x - defaultWidth / 2);
    frame.y = parseInt(figma.viewport.center.y - defaultHeight / 2);

    frame.name = frameTitle + " [" + result.progress + ":" + result.total + "]";

    frame.appendChild(progress);
  }

  figma.closePlugin();
};
