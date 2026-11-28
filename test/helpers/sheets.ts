type JsonNode = Readonly<{
  type: string;
  props: Record<string, unknown>;
  children: readonly (JsonNode | string)[] | null;
}>;
type Json = JsonNode | readonly JsonNode[] | null;
type Screen = Readonly<{ toJSON: () => unknown }>;

/** Every node of a screen's rendered tree, depth first. */
export const getRenderedNodes = (screen: Screen) => {
  const nodes: JsonNode[] = [];
  const walk = (node: Json | string) => {
    if (node === null || typeof node === 'string') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const element = node as JsonNode;
    nodes.push(element);
    (element.children ?? []).forEach(walk);
  };
  walk(screen.toJSON() as Json);
  return nodes;
};

/** The native sheets (react-native-screens' FormSheet) a screen renders (#867). */
export const getSheetHosts = (screen: Screen) =>
  getRenderedNodes(screen).filter((node) => node.type === 'RNSFormSheetHost');

/** The colour of the one sheet a screen renders. */
export const getSheetColor = (screen: Screen) => getSheetHosts(screen)[0]?.props.nativeContainerBackgroundColor;
