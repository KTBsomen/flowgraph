/**
 * security-patch.js — Global runtime hardening for expression evaluation.
 * 
 * Intercepts 'expr-eval' globally at runtime to block prototype pollution
 * and arbitrary code execution (ACE/RCE) attempts.
 */
try {
  const { Parser } = require('expr-eval');

  const FORBIDDEN_PATTERNS = [
    '__proto__',
    'constructor',
    'prototype',
    'function',
    'eval',
    'tostring',
    'valueof',
    'tojsfunction',
    'require'
  ];

  function checkSecurity(expression) {
    if (typeof expression === 'string') {
      const lower = expression.toLowerCase();
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (lower.includes(pattern)) {
          throw new Error(`Security Exception: Potentially malicious expression pattern "${pattern}" is forbidden.`);
        }
      }
    }
  }

  // Hook Parser.prototype.parse
  const originalParse = Parser.prototype.parse;
  Parser.prototype.parse = function (expression, ...args) {
    checkSecurity(expression);
    return originalParse.call(this, expression, ...args);
  };

  // Hook Parser.prototype.evaluate
  const originalEvaluate = Parser.prototype.evaluate;
  Parser.prototype.evaluate = function (expression, ...args) {
    checkSecurity(expression);
    return originalEvaluate.call(this, expression, ...args);
  };

  // Hook static Parser.evaluate if present
  if (typeof Parser.evaluate === 'function') {
    const originalStaticEvaluate = Parser.evaluate;
    Parser.evaluate = function (expression, ...args) {
      checkSecurity(expression);
      return originalStaticEvaluate.call(this, expression, ...args);
    };
  }

  console.log('🛡️  [Security Patch] Global expr-eval parser has been hardened successfully.');
} catch (err) {
  // If expr-eval is not installed or resolved, ignore silently
  console.warn('⚠️  [Security Patch] Failed to load/patch expr-eval:', err.message);
}
