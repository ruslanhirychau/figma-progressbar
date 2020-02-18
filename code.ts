const progressbar = figma.currentPage.selection[0];
const rectangle = progressbar["children"][0];

var [a, b] = progressbar.name.split(":").map(value => parseInt(value));

// console.log("Value A: " + a);
// console.log("Value B: " + b);

const difference = a / b;
//console.log("Difference: " + difference);

const newWidth = progressbar.width * difference;
//console.log("New width: " + newWidth);

rectangle.resize(newWidth, rectangle.height);

figma.closePlugin();
