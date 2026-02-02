const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const unusedImports = require("eslint-plugin-unused-imports");
const globals = require("globals");
const js = require("@eslint/js");

const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = [
  {
    ignores: [
      "**/.eslintrc.cjs",
      "**/dist/",
      "**/node_modules/",
      "**/coverage/",
    ],
  },
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ),
  {
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      ecmaVersion: 2022,

      parserOptions: {
        project: "tsconfig.json",
        tsconfigRootDir: __dirname,
      },

      globals: {
        ...globals.node,
      },
    },

    plugins: {
      "@typescript-eslint": typescriptEslint,
      "unused-imports": unusedImports,
    },

    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",

      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
        },
      ],

      "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],

      "@typescript-eslint/array-type": [
        "warn",
        {
          default: "array-simple",
        },
      ],

      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "interface",
          format: ["PascalCase"],
        },
        {
          selector: "typeAlias",
          format: ["PascalCase"],
        },
        {
          selector: "enum",
          format: ["PascalCase"],
        },
        {
          selector: "class",
          format: ["PascalCase"],
        },
      ],

      "unused-imports/no-unused-imports": "error",

      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],

      "no-debugger": "error",
      "no-alert": "error",
      "no-await-in-loop": "warn",
      "no-return-await": "off",
      "no-promise-executor-return": "error",
      "no-unsafe-optional-chaining": "error",
      "no-unused-private-class-members": "warn",
      "require-atomic-updates": "warn",

      eqeqeq: [
        "error",
        "always",
        {
          null: "ignore",
        },
      ],

      "no-var": "error",
      "prefer-const": "error",
      "prefer-arrow-callback": "warn",
      "prefer-template": "warn",

      "prefer-destructuring": [
        "warn",
        {
          object: true,
          array: false,
        },
      ],

      "prefer-rest-params": "warn",
      "prefer-spread": "warn",
      "no-useless-concat": "warn",
      "no-useless-return": "warn",
      "no-nested-ternary": "warn",
      "no-unneeded-ternary": "warn",
      "no-else-return": "warn",
      "no-lonely-if": "warn",
      "object-shorthand": ["warn", "always"],
      curly: ["error", "all"],
      "default-case-last": "warn",
      "dot-notation": "warn",
      "no-implicit-coercion": "warn",
      yoda: "warn",
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-nested-callbacks": ["warn", 4],
      "max-params": ["warn", 5],

      "max-lines": [
        "error",
        {
          max: 150,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      "max-lines-per-function": [
        "warn",
        {
          max: 50,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      semi: ["error", "always"],

      quotes: [
        "warn",
        "single",
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],

      "comma-dangle": ["warn", "always-multiline"],
      "arrow-parens": ["warn", "always"],

      "no-multiple-empty-lines": [
        "warn",
        {
          max: 1,
          maxEOF: 0,
        },
      ],

      "no-trailing-spaces": "warn",
      "eol-last": ["warn", "always"],

      indent: [
        "warn",
        2,
        {
          SwitchCase: 1,
        },
      ],

      "linebreak-style": ["error", "unix"],

      "space-before-function-paren": [
        "warn",
        {
          anonymous: "always",
          named: "never",
          asyncArrow: "always",
        },
      ],

      "keyword-spacing": "warn",
      "space-infix-ops": "warn",
      "comma-spacing": "warn",

      "brace-style": [
        "warn",
        "1tbs",
        {
          allowSingleLine: true,
        },
      ],

      "object-curly-spacing": ["warn", "always"],
      "array-bracket-spacing": ["warn", "never"],
      "computed-property-spacing": ["warn", "never"],
      "no-duplicate-imports": "error",

      "sort-imports": [
        "warn",
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "**/*.test.ts"],

    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
