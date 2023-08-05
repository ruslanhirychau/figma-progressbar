"use strict";
// console.clear();
// console.log("The plugin is up and running")
/* DATA STRUCTURE */
var ProgressTypes;
(function (ProgressTypes) {
    ProgressTypes["Bar"] = "bar";
    ProgressTypes["Pie"] = "pie";
})(ProgressTypes || (ProgressTypes = {}));
var SourceTypes;
(function (SourceTypes) {
    SourceTypes["Manual"] = "manual";
    SourceTypes["Random"] = "random";
    SourceTypes["Node"] = "node";
    SourceTypes["Nodes"] = "nodes";
})(SourceTypes || (SourceTypes = {}));
let storage = []; // [{…}, {…}, {…}]
function storageGet(key, props) {
    var _a;
    return props
        ? (_a = storage.find(item => key in item)) === null || _a === void 0 ? void 0 : _a[key] // Returns { key: { props }}
        : storage.find(item => item.hasOwnProperty(key)); // Returns { props }
}
function storageSet(record) {
    for (const key in record) {
        const existingIndex = storage.findIndex((item) => item.hasOwnProperty(key));
        if (existingIndex !== -1) {
            // Update the existing key's value
            const value = record[key];
            storage[existingIndex][key] = value;
        }
        else {
            // Add a new record to the storage
            storage.push(record);
        }
    }
}
/* CLIENT STORAGE */
const clientStorage = figma.clientStorage;
const clientStorageRecentKey = "recent";
const clientStorageRecordsKey = "records";
async function clientStorageGet(key) {
    try {
        return await clientStorage.getAsync(key);
    }
    catch (error) {
        console.error('Error retrieving data:', error);
        return {};
    }
}
async function clientStorageSet(key, value) {
    try {
        await clientStorage.setAsync(key, value);
    }
    catch (error) {
        console.error('Error retrieving data:', error);
    }
}
async function clientStorageReset(key) {
    try {
        // Resetting the client storage
        if (key) {
            await clientStorage.deleteAsync(key);
        }
        else {
            const keys = await clientStorage.keysAsync();
            for (let index = 0; index < keys.length; index++) {
                const element = keys[index];
                await clientStorage.deleteAsync(element);
            }
        }
    }
    catch (error) {
        console.error('Error retrieving data:', error);
    }
}
/* SYNC STORAGES */
var Sync;
(function (Sync) {
    Sync[Sync["Backup"] = 0] = "Backup";
    Sync[Sync["Restore"] = 1] = "Restore";
})(Sync || (Sync = {}));
async function storageSync(operation) {
    try {
        switch (operation) {
            case Sync.Restore:
                // Restoring recent props from the client storage
                const recent = await clientStorage.getAsync(clientStorageRecentKey);
                recentProps = recent ? recent[0] : defaultProps;
                // Restoring records
                const records = await clientStorage.getAsync(clientStorageRecordsKey);
                if (records) {
                    for (let index = 0; index < records.length; index++) {
                        const element = records[index];
                        storage.push(element);
                    }
                }
                break;
            case Sync.Backup:
                // Backuping to the client storage
                await clientStorageSet(clientStorageRecordsKey, storage);
                await clientStorageSet(clientStorageRecentKey, [recentProps]);
                break;
            default:
                break;
        }
    }
    catch (error) {
        console.error('Error retrieving data:', error);
    }
}
/* CORE */
function textContains(text, exact) {
    // Check if text contain exact string in any case
    const regex = new RegExp("\\b" + exact + "\\b", "i");
    return regex.test(text);
}
/* NODES */
var NodesTitle;
(function (NodesTitle) {
    NodesTitle["Progressbar"] = "Progressbar";
    NodesTitle["Value"] = "Value";
    NodesTitle["Total"] = "Total";
})(NodesTitle || (NodesTitle = {}));
function hasChildren(node, exact) {
    // Checking if the node even possible to have children
    if (node.type === "GROUP" ||
        node.type === "FRAME" ||
        node.type === "COMPONENT" ||
        node.type === "COMPONENT_SET" ||
        node.type === "SECTION" ||
        node.type === "INSTANCE") {
        //If no request for exact child return false
        if (!exact)
            return true;
        //Looking for exact node
        return node.children.some(child => textContains(child.name, exact));
    }
    return false;
}
function isProgressbar(sceneNode) {
    // Check if frame name contains NodesTitle.Progressbar and has a child named NodesTitle.Value
    // V2 MIGRATION
    if (sceneNode.type === "FRAME") {
        const title = sceneNode.name;
        const regex = /(\bProgressbar\b)\s\[(.*?)\]/;
        const exists = title.match(regex);
        // If it has name like Progressbar [0:100]
        if (exists) {
            const values = exists[2].split(":");
            const value = parseFloat(values[0]);
            const total = parseFloat(values[1]);
            const child = sceneNode.children[0];
            sceneNode.name = NodesTitle.Progressbar;
            // Change Rectangular to Frame named Value
            const valueFrame = figma.createFrame();
            valueFrame.name = NodesTitle.Value;
            valueFrame.resizeWithoutConstraints(child.width, child.height);
            valueFrame.fills = child.fills;
            valueFrame.cornerRadius = child.cornerRadius;
            valueFrame.strokes = child.strokes;
            valueFrame.effects = child.effects;
            sceneNode.appendChild(valueFrame);
            valueFrame.x = child.x;
            valueFrame.y = child.y;
            child.remove();
            const newProps = defaultProps;
            newProps.progressType = ProgressTypes.Bar;
            newProps.value = value;
            newProps.total = total;
            storageSet({ [sceneNode.id]: newProps });
        }
    }
    return textContains(sceneNode.name, NodesTitle.Progressbar) && hasChildren(sceneNode, NodesTitle.Value);
}
function extractProgressbars(selection) {
    // Return all progressbars found in selection
    // Extract Ids from the stored progressbars
    const storedIds = storage.map(obj => Object.keys(obj)[0]);
    const all = [];
    const stored = [];
    function inspectLevel(level) {
        level.forEach(node => {
            if (isProgressbar(node)) {
                // Found progressbar
                all.push(node);
                // The progressbar already stored
                if (storedIds.includes(node.id))
                    stored.push(node);
            }
            else if (hasChildren(node)) {
                // Checking just for not having error of 'children'
                if (node.type === "GROUP" ||
                    node.type === "FRAME" ||
                    node.type === "COMPONENT" ||
                    node.type === "COMPONENT_SET" ||
                    node.type === "SECTION") {
                    inspectLevel(node.children);
                }
            }
        });
    }
    inspectLevel(selection);
    return { all, stored };
}
const barAttrs = {
    body: {
        name: NodesTitle.Progressbar,
        width: 120,
        height: 8,
        layoutMode: 'HORIZONTAL',
        paddings: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
        },
        primaryAxisSizingMode: 'FIXED',
        counterAxisSizingMode: 'FIXED',
        primaryAxisAlignItems: 'MIN',
        counterAxisAlignItems: 'CENTER',
        fills: {
            type: 'SOLID',
            color: {
                r: 0.73333,
                g: 0.73333,
                b: 0.73333
            }
        }
    },
    value: {
        name: NodesTitle.Value,
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'FILL',
        fills: {
            type: 'SOLID',
            color: {
                r: 0.08235,
                g: 0.08235,
                b: 0.08235
            }
        }
    }
};
const pieAttrs = {
    body: {
        name: NodesTitle.Progressbar,
        layoutMode: 'NONE',
        width: 48,
        height: 48,
        radius: 0.84,
        fills: {
            type: 'SOLID',
            color: {
                r: 0.73333,
                g: 0.73333,
                b: 0.73333
            }
        }
    },
    value: {
        name: NodesTitle.Value,
        fills: {
            type: 'SOLID',
            color: {
                r: 0.08235,
                g: 0.08235,
                b: 0.08235
            }
        }
    },
    total: {
        name: NodesTitle.Total,
        fills: {
            type: 'SOLID',
            color: {
                r: 0.73333,
                g: 0.73333,
                b: 0.73333
            }
        }
    }
};
const defaultProps = {
    progressType: ProgressTypes.Bar,
    sourceType: SourceTypes.Manual,
    value: 50,
    total: 100,
    source1: '',
    source2: '',
    min: 0,
    max: 100,
    remain: false
};
let recentProps = defaultProps;
function restoreProgressbar(progressbar) {
    // Set default props with right type
    const newProps = defaultProps;
    newProps.progressType = hasChildren(progressbar, NodesTitle.Total)
        ? ProgressTypes.Pie
        : ProgressTypes.Bar;
    storageSet({ [progressbar.id]: newProps });
}
function createProgressbar(props, selected) {
    var _a, _b, _c, _d, _e, _f;
    // Drawing progressbar
    const parent = !selected
        ? figma.currentPage
        : isProgressbar(selected)
            ? selected.parent
            : selected;
    const attrs = props.progressType === ProgressTypes.Bar ? barAttrs : pieAttrs;
    // Create body
    const body = figma.createFrame();
    body.name = attrs.body.name;
    body.resize(attrs.body.width, attrs.body.height);
    if (props.progressType === ProgressTypes.Bar) {
        body.layoutMode = attrs.body.layoutMode;
        body.paddingLeft = ((_a = attrs.body.paddings) === null || _a === void 0 ? void 0 : _a.left) || 0;
        body.paddingRight = ((_b = attrs.body.paddings) === null || _b === void 0 ? void 0 : _b.right) || 0;
        body.paddingTop = ((_c = attrs.body.paddings) === null || _c === void 0 ? void 0 : _c.top) || 0;
        body.paddingBottom = ((_d = attrs.body.paddings) === null || _d === void 0 ? void 0 : _d.bottom) || 0;
        body.primaryAxisSizingMode = attrs.body.primaryAxisSizingMode || 'FIXED';
        body.counterAxisSizingMode = attrs.body.counterAxisSizingMode || 'FIXED';
        body.primaryAxisAlignItems = props.remain ? 'MAX' : 'MIN';
        body.counterAxisAlignItems = attrs.body.counterAxisAlignItems || 'CENTER';
        body.fills = [attrs.body.fills];
        // Create value
        const value = figma.createFrame();
        body.appendChild(value);
        value.name = attrs.value.name;
        value.layoutSizingHorizontal = attrs.value.layoutSizingHorizontal || 'FILL';
        value.layoutSizingVertical = attrs.value.layoutSizingVertical || 'FILL';
        value.fills = [attrs.value.fills];
    }
    else if (props.progressType === ProgressTypes.Pie) {
        body.fills = [];
        // Creating total
        const total = figma.createEllipse();
        total.name = ((_e = attrs.total) === null || _e === void 0 ? void 0 : _e.name) || "undefined";
        total.resize(attrs.body.width, attrs.body.height);
        total.fills = [((_f = attrs.total) === null || _f === void 0 ? void 0 : _f.fills) || attrs.body.fills];
        total.arcData = { startingAngle: 0, endingAngle: 2 * Math.PI, innerRadius: attrs.body.radius || 42 };
        body.appendChild(total);
        // Creating value
        const value = figma.createEllipse();
        value.name = attrs.value.name;
        value.resize(attrs.body.width, attrs.body.height);
        value.fills = [attrs.value.fills];
        body.appendChild(value);
    }
    // Positioning at the center of parent or viewport
    // Checking just for not having error of 'null'
    if ((parent === null || parent === void 0 ? void 0 : parent.type) === "FRAME"
        || (parent === null || parent === void 0 ? void 0 : parent.type) === "COMPONENT"
        || (parent === null || parent === void 0 ? void 0 : parent.type) === "COMPONENT_SET"
        || (parent === null || parent === void 0 ? void 0 : parent.type) === "SECTION") {
        parent.appendChild(body);
        body.x = parent.width / 2 - attrs.body.width / 2;
        body.y = parent.height / 2 - attrs.body.height / 2;
    }
    else if ((parent === null || parent === void 0 ? void 0 : parent.type) === "GROUP") {
        // While changing Type
        body.x = parent.x;
        body.y = parent.y - attrs.body.width / 2;
        parent.appendChild(body);
    }
    else {
        body.x = figma.viewport.center.x - attrs.body.width / 2;
        body.y = figma.viewport.center.y - attrs.body.height / 2;
    }
    // Store changes
    storageSet({ [body.id]: props });
    // Assign values
    updateProgressabars([body], props);
    return body;
}
function updateProgressabars(progressbars, props) {
    // Update values in progressbars
    const updatedNodes = [];
    function calculatePercenage(value, total) {
        if (total === 0)
            throw new Error("Total cannot be zero.");
        return (value / total) * 100;
    }
    function percentageToRadians(percentage) {
        const normalizedPercentage = percentage / 100;
        return (normalizedPercentage * Math.PI * 2) - Math.PI / 2;
    }
    function percentageToWidth(percentage, total) {
        const value = percentage <= 100 ? (percentage / 100) * total : total;
        if (value <= 0)
            return 0;
        if (value > total)
            return total;
        return value;
    }
    function getRandomNumber(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    function changeType(progressbar) {
        const parent = progressbar.parent || figma.currentPage;
        const tempGroup = figma.group([progressbar], parent);
        const newProgressbar = createProgressbar(props, progressbar);
        progressbar.remove();
        figma.ungroup(tempGroup);
        return newProgressbar;
    }
    function updateValue(progressbar, percentage) {
        if (progressbar.type !== "FRAME" &&
            progressbar.type !== "COMPONENT" &&
            progressbar.type !== "INSTANCE")
            throw new Error("Progressbat have to be FRAME, COMPONENT or INSTANCE");
        const attrs = props.progressType === ProgressTypes.Bar ? barAttrs : pieAttrs;
        const valueFrame = progressbar.findChild(child => child.name === attrs.value.name);
        const isVisible = !(props.remain ? percentage >= 100 : percentage <= 0);
        if (valueFrame) {
            if (props.progressType === ProgressTypes.Bar && valueFrame.type === "FRAME") {
                // Bar type
                progressbar.primaryAxisAlignItems = props.remain ? 'MAX' : 'MIN';
                const usersPadding = Math.min(progressbar.paddingLeft, progressbar.paddingRight);
                const actualWidth = progressbar.width - usersPadding * 2;
                if (progressbar.type === "FRAME") {
                    // Operating by width
                    let newWidth = percentageToWidth(percentage, progressbar.width - usersPadding * 2);
                    if (props.remain)
                        newWidth = actualWidth - newWidth;
                    valueFrame.resize(isVisible ? newWidth : 0.01, valueFrame.height);
                    valueFrame.layoutSizingHorizontal = "FIXED";
                }
                else if (progressbar.type === "INSTANCE") {
                    // Operating by paddings
                    const newPadding = percentageToWidth(props.remain ? percentage : 100 - percentage, actualWidth) + usersPadding;
                    progressbar.paddingRight = props.remain ? usersPadding : newPadding;
                    progressbar.paddingLeft = props.remain ? newPadding : usersPadding;
                    valueFrame.layoutSizingHorizontal = "FILL";
                }
                valueFrame.visible = isVisible;
            }
            else if (props.progressType === ProgressTypes.Pie && valueFrame.type === "ELLIPSE") {
                // Pie type
                const startingAngle = props.remain ? percentageToRadians(-(100 - percentage)) : -Math.PI / 2;
                const endingAngle = props.remain ? -Math.PI / 2 : percentageToRadians(percentage);
                const innerRadius = valueFrame.arcData.innerRadius || attrs.body.radius || 0.84;
                valueFrame.arcData = { startingAngle, endingAngle, innerRadius };
                valueFrame.visible = isVisible;
            }
        }
    }
    // Updating each progressbar
    for (const [index, progressbar] of progressbars.entries()) {
        // console.log("[" + props.sourceType + "] Updating " + (index + 1) + " of " + progressbars.length + " : " + progressbar.id);
        const currentId = progressbar.id;
        let currentProps = storageGet(currentId, true);
        if (!currentProps) {
            restoreProgressbar(progressbar);
            currentProps = storageGet(currentId, true);
        }
        const isNewTypeRequired = currentProps && props.progressType !== currentProps.progressType;
        const progressToUpdate = isNewTypeRequired ? changeType(progressbar) : progressbar;
        var value = 0;
        var total = 0;
        switch (props.sourceType) {
            case SourceTypes.Manual:
                value = props.value;
                total = props.total;
                break;
            case SourceTypes.Random:
                value = getRandomNumber(props.min, props.max);
                total = 100;
                break;
            default:
                break;
        }
        updateValue(progressToUpdate, calculatePercenage(value, total));
        storageSet({ [progressToUpdate.id]: props });
        updatedNodes.push(progressToUpdate);
    }
    return updatedNodes;
}
/* RUNS */
function reset() {
    clientStorageReset().then(() => {
        storage = [];
        figma.notify("Done! Like a new one!");
        figma.closePlugin();
    });
}
function add() {
    console.log("Adding progressbar...");
    storageSync(Sync.Restore).then(() => {
        const selection = figma.currentPage.selection;
        const selected = selection.length ? selection[0] : undefined;
        const message = {
            command: Commands.Add,
            count: 0,
            props: recentProps
        };
        showUI(message);
        figma.ui.onmessage = async (receivedData) => {
            figma.ui.hide();
            /*
              [ ] Support node source
              [ ] Support nodes source
              [ ] Support random source
            */
            // When source is node
            // if (receivedData.props.source === "node" || receivedData.props.source === "nodes") {
            //   console.log("Needs to find source nodes")
            //   const source: Source = { source1: receivedData.props.source1, source2: receivedData.props.source2 }
            //   extractSource(source);
            //   console.log(source);
            // }
            const newNode = createProgressbar(receivedData.props, selected);
            recentProps = receivedData.props;
            // Select new progressbar
            figma.currentPage.selection = [newNode];
            figma.viewport.scrollAndZoomIntoView([newNode]);
            storageSync(Sync.Backup).then(() => {
                figma.notify("Progressbar added!");
                figma.closePlugin();
            });
        };
    });
}
function edit() {
    const selection = figma.currentPage.selection;
    if (!selection.length) {
        figma.notify("Select progressbars to edit");
        figma.closePlugin();
    }
    storageSync(Sync.Restore).then(() => {
        const progressbars = extractProgressbars(selection);
        if (!progressbars.all.length) {
            figma.notify("No progressbars was found in selection");
            figma.closePlugin();
        }
        let propsToSend = defaultProps;
        if (progressbars.stored.length) {
            // Getting params from first in storage
            const id = progressbars.stored[0].id;
            const props = storageGet(id, true);
            propsToSend = props || defaultProps;
        }
        else {
            // Restore params for the first selected
            const element = progressbars.all[0];
            restoreProgressbar(element);
            propsToSend = storageGet(element.id, true) || defaultProps;
        }
        const message = {
            command: Commands.Edit,
            count: progressbars.all.length,
            props: propsToSend
        };
        showUI(message);
        figma.ui.onmessage = async (receivedData) => {
            figma.ui.hide();
            recentProps = receivedData.props;
            const updatedNodes = updateProgressabars(progressbars.all, receivedData.props);
            // Select updated progressbars
            figma.currentPage.selection = updatedNodes;
            // figma.viewport.scrollAndZoomIntoView(updatedNodes);
            storageSync(Sync.Backup).then(() => {
                figma.notify("Progressbars edited!");
                figma.closePlugin();
            });
        };
    });
}
function update() {
    /*
      [ ] Found stored progressbars with source: node
      [ ] Find source nodes
      [ ] Get value from nodes
      [ ] Update
    */
}
function test() {
    const selection = figma.currentPage.selection;
    if (!selection.length) {
        figma.notify("Select node to test");
        figma.closePlugin();
    }
    storageSync(Sync.Restore).then(() => {
        console.log(storage.length);
        console.log(extractProgressbars(selection));
        for (const [index, node] of selection.entries()) {
            console.log("Test " + (index + 1) + " of " + selection.length + " : " + node.id);
            console.log("Node Id: " + node.id);
            console.log("Progressbar: " + isProgressbar(node));
            console.log(storageGet(node.id));
        }
        ;
        figma.closePlugin();
    });
}
function showUI(messageData) {
    figma.showUI(__html__, { width: 306, height: 358 });
    figma.ui.postMessage(messageData);
}
/* COMMANDS */
var Commands;
(function (Commands) {
    Commands["Reset"] = "reset";
    Commands["Add"] = "add";
    Commands["Edit"] = "edit";
    // Update = "update",
    // Test = "test"
})(Commands || (Commands = {}));
const commandFunctions = {
    [Commands.Reset]: reset,
    [Commands.Add]: add,
    [Commands.Edit]: edit,
    // [Commands.Update]: update,
    // [Commands.Test]: test
};
const commandFunction = commandFunctions[figma.command];
if (commandFunction)
    commandFunction();
