// opencc-js's dictionaries, one per file, each a "simplified traditional|..."
// list (services/ChineseScript.ts). The package ships no types for them.
declare module 'opencc-js/dict/*' {
  const dictionary: string;
  export default dictionary;
}
