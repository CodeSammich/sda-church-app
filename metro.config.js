const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The Bible texts that ship with the app (assets/bible) are files the app reads
// when a book opens, not JavaScript, so Metro bundles them as assets.
config.resolver.assetExts.push("biblejson");

module.exports = config;
