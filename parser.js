/**
 * @fileoverview Parser that converts TypeScript into ESTree format.
 * @author Nicholas C. Zakas
 * @author James Henry <https://github.com/JamesHenry>
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

"use strict";

const parse = require("typescript-estree").parse;
const astNodeTypes = require("typescript-estree").AST_NODE_TYPES;
const traverser = require("eslint/lib/util/traverser");
const analyzeScope = require("./analyze-scope");
const visitorKeys = require("./visitor-keys");

//------------------------------------------------------------------------------
// Public
//------------------------------------------------------------------------------

exports.version = require("./package.json").version;

exports.parseForESLint = function parseForESLint(code, inputOptions) {
    const options = Object.assign({
        useJSXTextNode: true,
        // typescript-estree doesn't respect ecmaFeatures object
        jsx: false
    }, inputOptions);

    if (typeof options.useJSXTextNode !== "boolean") {
        options.useJSXTextNode = true;
    }

    options.jsx = (options.ecmaFeatures || {}).jsx;
    if (typeof options.jsx !== "boolean") {
        options.jsx = false;
    }

    // override the jsx option depending on the file path
    if (typeof inputOptions.filePath === "string") {
        const tsx = inputOptions.filePath.endsWith(".tsx");
        if (tsx || inputOptions.filePath.endsWith(".ts")) {
            options.jsx = tsx;
        }
    }

    const ast = parse(code, options);
    const extraOptions = {
        sourceType: ast.sourceType
    };

    traverser.traverse(ast, {
        enter: node => {
            switch (node.type) {
                // Just for backward compatibility.
                case "DeclareFunction":
                    if (!node.body) {
                        node.type = `TSEmptyBody${node.type}`;
                    }
                    break;

                // Function#body cannot be null in ESTree spec.
                case "FunctionExpression":
                case "FunctionDeclaration":
                    if (!node.body) {
                        node.type = `TSEmptyBody${node.type}`;
                    }
                    break;

                // Import/Export declarations cannot appear in script.
                // But if those appear only in namespace/module blocks, `ast.sourceType` was `"script"`.
                // This doesn't modify `ast.sourceType` directly for backward compatibility.
                case "ImportDeclaration":
                case "ExportAllDeclaration":
                case "ExportDefaultDeclaration":
                case "ExportNamedDeclaration":
                    extraOptions.sourceType = "module";
                    break;

                // no default
            }
        }
    });

    const scopeManager = analyzeScope(ast, options, extraOptions);
    return { ast, scopeManager, visitorKeys };
};

exports.parse = function(code, options) {
    return this.parseForESLint(code, options).ast;
};

// Deep copy.
/* istanbul ignore next */
exports.Syntax = (function() {
    let name,
        types = {};

    if (typeof Object.create === "function") {
        types = Object.create(null);
    }

    for (name in astNodeTypes) {
        if (astNodeTypes.hasOwnProperty(name)) {
            types[name] = astNodeTypes[name];
        }
    }

    if (typeof Object.freeze === "function") {
        Object.freeze(types);
    }

    return types;
}());
