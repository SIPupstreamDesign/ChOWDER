module.exports = function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy("document/**/*.png");
    eleventyConfig.addPassthroughCopy("document/style.css");

    return {
        dir: {
            input: "document",
            output: "dist/docs/manual",
            layouts: "_layouts",
        },
        markdownTemplateEngine: "njk",
    };
}
