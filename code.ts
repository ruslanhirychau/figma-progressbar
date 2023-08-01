console.clear();
console.log("The plugin is up and running")

/*
  [✓] Define data type
  [✓] Stogage data in variables
  [✓] Update the client storage with data then changed
  [✓] Get data from the client storage to variable
  [✓] Support copy progressbars
  [✓] Support changing progressbar type
  [✓] Support current Progressbar [50 : 100]
  [✓] Support autolayout for Bars
  [✓] Support instances
  [ ] Get values form nodes
  [ ] Random values
*/

/* DATA STRUCTURE */

enum ProgressTypes {
  Bar = "bar",
  Pie = "pie"
}

enum SourceTypes {
  Manual = "manual",
  Node = "node",
  Nodes = "nodes",
  Random = "random"
}

interface Props {
  progressType: ProgressTypes
  sourceType: SourceTypes;
  value: number;
  total: number;
  source1: string;
  source2: string;
  min: number;
  max: number;
  remain: boolean;
}

/* DATA STORAGE */

interface StoreRecord {
  [key: string]: Props;
}

let storage: StoreRecord[] = []  // [{…}, {…}, {…}]

function storageGet(key: string, props?: boolean): StoreRecord | Props | undefined {
  return props
    ? storage.find(item => key in item)?.[key] // Returns { key: { props }}
    : storage.find(item => item.hasOwnProperty(key)) // Returns { props }
}

function storageSet(record: StoreRecord): void {
  for (const key in record) {
    const existingIndex = storage.findIndex((item) => item.hasOwnProperty(key));

    if (existingIndex !== -1) {
      // Update the existing key's value
      const value = record[key];
      storage[existingIndex][key] = value;
    } else {
      // Add a new record to the storage
      storage.push(record);
    }
  }
}

/* CLIENT STORAGE */

const clientStorage = figma.clientStorage;
const clientStorageRecentKey = "recent";
const clientStorageRecordsKey = "records";

async function clientStorageGet(key: string): Promise<Object> {
  try {
    return await clientStorage.getAsync(key);
  } catch (error) {
    console.error('Error retrieving data:', error);
    return {};
  }
}

async function clientStorageSet(key: string, value: Object[]): Promise<void> {
  try {
    await clientStorage.setAsync(key, value);
  } catch (error) {
    console.error('Error retrieving data:', error);
  }
}

async function clientStorageReset(key?: string): Promise<void> {
  try {
    // Resetting the client storage
    if (key) {
      await clientStorage.deleteAsync(key);
    } else {
      const keys = await clientStorage.keysAsync();
      for (let index = 0; index < keys.length; index++) {
        const element = keys[index];
        await clientStorage.deleteAsync(element);
      }
    }
  } catch (error) {
    console.error('Error retrieving data:', error);
  }
}

/* SYNC STORAGES */

enum Sync {
  Backup,
  Restore
}

async function storageSync(operation: Sync): Promise<void> {
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
  } catch (error) {
    console.error('Error retrieving data:', error);
  }
}

/* CORE */

function textContains(text: string, exact: string): boolean {
  // Check if text contain exact string in any case
  const regex = new RegExp("\\b" + exact + "\\b", "i");
  return regex.test(text);
}

/* NODES */

enum NodesTitle {
  Progressbar = "Progressbar",
  Value = "Value",
  Total = "Total"
}

function hasChildren(node: SceneNode, exact?: string): boolean {
  // Checking if the node even possible to have children
  if (
    node.type === "GROUP" ||
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "COMPONENT_SET" ||
    node.type === "SECTION" ||
    node.type === "INSTANCE"
  ) {
    //If no request for exact child return false
    if (!exact) return true;

    //Looking for exact node
    return node.children.some(child => textContains(child.name, exact));
  }

  return false;
}

function isProgressbar(sceneNode: SceneNode): boolean {
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
      const child = sceneNode.children[0] as RectangleNode;

      sceneNode.name = NodesTitle.Progressbar;

      // Change Rectangular to Frame named Value
      const valueFrame = figma.createFrame();
      valueFrame.name = NodesTitle.Value
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

interface Progressbars {
  all: SceneNode[];
  stored: SceneNode[];
}

function extractProgressbars(selection: readonly SceneNode[]): Progressbars {
  // Return all progressbars found in selection

  // Extract Ids from the stored progressbars
  const storedIds = storage.map(obj => Object.keys(obj)[0]);

  const all: SceneNode[] = [];
  const stored: SceneNode[] = [];

  function inspectLevel(level: readonly SceneNode[]): void {
    level.forEach(node => {
      if (isProgressbar(node)) {
        // Found progressbar
        all.push(node);

        // The progressbar already stored
        if (storedIds.includes(node.id)) stored.push(node);
      } else if (hasChildren(node)) {
        // Checking just for not having error of 'children'
        if (
          node.type === "GROUP" ||
          node.type === "FRAME" ||
          node.type === "COMPONENT" ||
          node.type === "COMPONENT_SET" ||
          node.type === "SECTION"
        )
          inspectLevel(node.children);
      }
    });
  }

  inspectLevel(selection);
  return { all, stored };
}

/* DRAWING */

interface Attrs {
  body: {
    name: NodesTitle,
    width: number,
    height: number,
    radius?: number,
    layoutMode: 'HORIZONTAL' | 'NONE',
    paddings?: {
      left: number
      right: number
      top: number
      bottom: number
    },
    primaryAxisSizingMode?: 'FIXED',
    counterAxisSizingMode?: 'FIXED',
    primaryAxisAlignItems?: 'MIN' | 'MAX',
    counterAxisAlignItems?: 'CENTER',
    fills: Paint
  },
  value: {
    name: NodesTitle,
    layoutSizingHorizontal?: 'FILL',
    layoutSizingVertical?: 'FILL',
    fills: Paint
  },
  total?: {
    name: NodesTitle,
    fills: Paint
  }
}

const barAttrs: Attrs = {
  body: {
    name: NodesTitle.Progressbar,
    width: 120,
    height: 8,
    layoutMode: 'HORIZONTAL',
    paddings: {
      left: 2,
      right: 2,
      top: 2,
      bottom: 2,
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
}

const pieAttrs: Attrs = {
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
}

const defaultProps: Props = {
  progressType: ProgressTypes.Bar,
  sourceType: SourceTypes.Manual,
  value: 22,
  total: 100,
  source1: '',
  source2: '',
  min: 0,
  max: 100,
  remain: false
}

let recentProps: Props = defaultProps;

function createProgressbar(props: Props, selected?: SceneNode): SceneNode {
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
    body.paddingLeft = attrs.body.paddings?.left || 0;
    body.paddingRight = attrs.body.paddings?.right || 0;
    body.paddingTop = attrs.body.paddings?.top || 0;
    body.paddingBottom = attrs.body.paddings?.bottom || 0;
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

  } else if (props.progressType === ProgressTypes.Pie) {
    body.fills = [];

    // Creating total
    const total = figma.createEllipse();
    total.name = attrs.total?.name || "undefined";
    total.resize(attrs.body.width, attrs.body.height);
    total.fills = [attrs.total?.fills || attrs.body.fills];
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
  if (parent?.type === "FRAME"
    || parent?.type === "COMPONENT"
    || parent?.type === "COMPONENT_SET"
    || parent?.type === "SECTION") {
    parent.appendChild(body);

    body.x = parent.width / 2 - attrs.body.width / 2;
    body.y = parent.height / 2 - attrs.body.height / 2;
  } else if (parent?.type === "GROUP") {
    // While changing Type
    body.x = parent.x;
    body.y = parent.y - attrs.body.width / 2;
    parent.appendChild(body);

  } else {
    body.x = figma.viewport.center.x - attrs.body.width / 2;
    body.y = figma.viewport.center.y - attrs.body.height / 2;
  }

  // Store changes
  storageSet({ [body.id]: props } as StoreRecord);

  // Assign values
  updateProgressabars([body], props);

  return body;
}

function updateProgressabars(progressbars: SceneNode[], props: Props): SceneNode[] {
  // Update values in progressbars

  function calculatePercenage(value: number, total: number): number {
    if (total === 0) throw new Error("Total cannot be zero.");
    return (value / total) * 100;
  }

  function percentageToRadians(percentage: number): number {
    const normalizedPercentage = percentage / 100;
    return (normalizedPercentage * Math.PI * 2) - Math.PI / 2;
  }

  function percentageToWidth(percentage: number, total: number): number {
    const value = percentage <= 100 ? (percentage / 100) * total : total;
    if (value <= 0) return 0;
    if (value > total) return total;
    return value;
  }

  function restoreProps(progressbar: SceneNode) {
    // Restore 
    const newProps: Props = defaultProps;
    newProps.progressType = hasChildren(progressbar, NodesTitle.Total)
      ? ProgressTypes.Pie
      : ProgressTypes.Bar;

    console.log(newProps)

    storageSet({ [progressbar.id]: newProps } as StoreRecord);
  }

  function changeType(progressbar: SceneNode): SceneNode {
    const parent = progressbar.parent || figma.currentPage;
    const tempGroup = figma.group([progressbar], parent);
    const newProgressbar = createProgressbar(props, progressbar);

    progressbar.remove();
    figma.ungroup(tempGroup);

    return newProgressbar;
  }

  function updateValue(progressbar: SceneNode, percentage: number): void {
    if (
      progressbar.type !== "FRAME" &&
      progressbar.type !== "COMPONENT" &&
      progressbar.type !== "INSTANCE"
    ) throw new Error("Progressbat have to be FRAME or COMPONENT");

    const attrs = props.progressType === ProgressTypes.Bar ? barAttrs : pieAttrs;
    const valueFrame = progressbar.findChild(child => child.name === attrs.value.name);
    const isVisible: boolean = !(props.remain ? percentage >= 100 : percentage <= 0);

    if (valueFrame) {
      if (props.progressType === ProgressTypes.Bar && valueFrame.type === "FRAME") {
        // Bar type
        progressbar.primaryAxisAlignItems = props.remain ? 'MAX' : 'MIN';

        const usersPadding = Math.min(progressbar.paddingLeft, progressbar.paddingRight);
        const actualWidth = progressbar.width - usersPadding * 2;

        if (progressbar.type === "FRAME") {
          // Operating by width
          let newWidth = percentageToWidth(percentage, progressbar.width - usersPadding * 2);
          if (props.remain) newWidth = actualWidth - newWidth;

          valueFrame.resize(isVisible ? newWidth : 0.01, valueFrame.height);
          valueFrame.layoutSizingHorizontal = "FIXED";

        } else if (progressbar.type === "INSTANCE") {
          // Operating by paddings
          const newPadding = percentageToWidth(props.remain ? percentage : 100 - percentage, actualWidth) + usersPadding;

          progressbar.paddingRight = props.remain ? usersPadding : newPadding;
          progressbar.paddingLeft = props.remain ? newPadding : usersPadding;
          valueFrame.layoutSizingHorizontal = "FILL";
        }

        valueFrame.visible = isVisible;
      } else if (props.progressType === ProgressTypes.Pie && valueFrame.type === "ELLIPSE") {
        // Pie type
        const startingAngle = props.remain ? percentageToRadians(-(100 - percentage)) : -Math.PI / 2;
        const endingAngle = props.remain ? -Math.PI / 2 : percentageToRadians(percentage);
        const innerRadius = attrs.body.radius || 42;

        valueFrame.arcData = { startingAngle, endingAngle, innerRadius };
        valueFrame.visible = isVisible;
      }
    }
  }

  const percentage = calculatePercenage(props.value, props.total);
  const updatedNodes: SceneNode[] = [];

  function updateProgressBars(progressbars: SceneNode[], percentage: number): void {
    for (const [index, progressbar] of progressbars.entries()) {
      console.log("Updating " + (index + 1) + " of " + progressbars.length + " : " + progressbar.id);

      const currentId = progressbar.id;
      let currentProps = storageGet(currentId, true);

      if (!currentProps) {
        restoreProps(progressbar);
        currentProps = storageGet(currentId, true);
      }

      const isNewTypeRequired = currentProps && props.progressType !== currentProps.progressType;
      const progressToUpdate = isNewTypeRequired ? changeType(progressbar) : progressbar;

      updateValue(progressToUpdate, percentage);
      storageSet({ [progressToUpdate.id]: props });
      updatedNodes.push(progressToUpdate);
    }
  }

  updateProgressBars(progressbars, percentage);
  return updatedNodes;
}

/* RUNS */

function reset(): void {
  clientStorageReset().then(() => {
    storage = [];
    figma.notify("Done! Like a new one!");
    figma.closePlugin();
  });
}

function add(): void {
  console.log("Adding progressbar...");

  storageSync(Sync.Restore).then(() => {
    const selection = figma.currentPage.selection;
    const selected = selection.length ? selection[0] : undefined;

    const message: Message = {
      command: Commands.Add,
      count: 0,
      props: recentProps
    }

    showUI(message);

    figma.ui.onmessage = async receivedData => {
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
    }
  });
}

function edit(): void {
  const selection = figma.currentPage.selection;

  if (!selection.length) {
    figma.notify("Select progressbars to edit");
    figma.closePlugin();
  }

  storageSync(Sync.Restore).then(() => {
    const progressbars: Progressbars = extractProgressbars(selection);

    if (!progressbars.all.length) {
      figma.notify("No progressbars was found in selection");
      figma.closePlugin();
    }

    let propsToSend = defaultProps;

    if (progressbars.stored.length) {
      const firstRecord = progressbars.stored[0].id;
      const firstProps = storage.find(record => firstRecord in record)?.[firstRecord];
      propsToSend = firstProps || defaultProps;
    }

    const message: Message = {
      command: Commands.Edit,
      count: progressbars.all.length,
      props: propsToSend
    };

    showUI(message);

    figma.ui.onmessage = async receivedData => {
      figma.ui.hide();

      /* 
        [ ] Support node source
        [ ] Support nodes source 
        [ ] Support random source
      */

      const updatedNodes = updateProgressabars(progressbars.all, receivedData.props)
      recentProps = receivedData.props;

      // Select updated progressbars
      // figma.currentPage.selection = updatedNodes;
      // figma.viewport.scrollAndZoomIntoView(updatedNodes);

      storageSync(Sync.Backup).then(() => {
        figma.notify("Progressbars edited!");
        figma.closePlugin();
      });
    }
  });


}

function update(): void {
  /* 
    [ ] Found stored progressbars with source: node
    [ ] Find source nodes
    [ ] Get value from nodes
    [ ] Update
  */
}

function test(): void {
  const selection = figma.currentPage.selection;

  if (!selection.length) {
    figma.notify("Select node to test");
    figma.closePlugin();
  }

  storageSync(Sync.Restore).then(() => {
    console.log(storage.length);
    console.log(extractProgressbars(selection))

    for (const [index, node] of selection.entries()) {
      console.log("Test " + (index + 1) + " of " + selection.length + " : " + node.id);
      console.log("Node Id: " + node.id);
      console.log("Progressbar: " + isProgressbar(node));
      console.log(storageGet(node.id))
    };

    figma.closePlugin();
  });
}

/* UI COMMUNUCATION */

interface Message {
  command: Commands,
  count: number,
  props: Props
}

function showUI(messageData: Message) {
  figma.showUI(__html__, { width: 306, height: 358 });
  figma.ui.postMessage(messageData);
}

/* COMMANDS */

enum Commands {
  Reset = "reset",
  Add = "add",
  Edit = "edit",
  Update = "update",
  Test = "test"
}

const commandFunctions = {
  [Commands.Add]: add,
  [Commands.Edit]: edit,
  [Commands.Update]: update,
  [Commands.Reset]: reset,
  [Commands.Test]: test
};

const commandFunction = commandFunctions[figma.command as Commands];
if (commandFunction) commandFunction();