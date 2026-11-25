#!/usr/bin/env python3
"""Unit tests for DUCS contrast parsing, token resolution and WCAG math."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "test-ducs-contrast.py"
SPEC = importlib.util.spec_from_file_location("ducs_contrast_audit", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load scripts/test-ducs-contrast.py")
audit = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = audit
SPEC.loader.exec_module(audit)


class ColorParsingTests(unittest.TestCase):
    def test_short_hex_expands_rgb(self):
        self.assertEqual(audit.parse_color("#abc"), (170, 187, 204, 1.0))

    def test_short_hex_alpha_expands(self):
        self.assertEqual(audit.parse_color("#abcd"), (170, 187, 204, 221 / 255))

    def test_long_hex_with_alpha(self):
        self.assertEqual(audit.parse_color("#11223380"), (17, 34, 51, 128 / 255))

    def test_modern_rgb_space_and_slash_syntax(self):
        self.assertEqual(audit.parse_color("rgb(255 0 128 / 50%)"), (255, 0, 128, 0.5))

    def test_rgb_percentage_channels(self):
        parsed = audit.parse_color("rgba(100%, 0%, 50%, .25)")
        self.assertAlmostEqual(parsed[0], 255)
        self.assertAlmostEqual(parsed[1], 0)
        self.assertAlmostEqual(parsed[2], 127.5)
        self.assertAlmostEqual(parsed[3], .25)

    def test_rejects_out_of_range_channel(self):
        with self.assertRaises(AssertionError):
            audit.parse_color("rgb(256 0 0)")

    def test_rejects_unsupported_color_grammar(self):
        with self.assertRaises(AssertionError):
            audit.parse_color("hsl(0 0% 0%)")


class TokenResolutionTests(unittest.TestCase):
    def test_resolves_nested_references(self):
        tokens = {"--a": "var(--b)", "--b": "var(--c)", "--c": "#123456"}
        self.assertEqual(audit.resolve_token("--a", tokens), "#123456")

    def test_uses_fallback_when_reference_is_missing(self):
        tokens = {"--a": "var(--missing, #abcdef)"}
        self.assertEqual(audit.resolve_token("--a", tokens), "#abcdef")

    def test_missing_reference_without_fallback_fails(self):
        with self.assertRaises(AssertionError):
            audit.resolve_token("--a", {"--a": "var(--missing)"})

    def test_circular_reference_fails(self):
        tokens = {"--a": "var(--b)", "--b": "var(--a)"}
        with self.assertRaises(AssertionError):
            audit.resolve_token("--a", tokens)

    def test_composite_var_expression_fails_closed(self):
        tokens = {"--a": "linear-gradient(var(--b), var(--c))", "--b": "#000", "--c": "#fff"}
        with self.assertRaises(AssertionError):
            audit.resolve_token("--a", tokens)


class ContrastMathTests(unittest.TestCase):
    def test_black_and_white_ratio_is_21(self):
        black = audit.parse_color("#000")
        white = audit.parse_color("#fff")
        self.assertAlmostEqual(audit.contrast(black, white), 21.0, places=6)

    def test_alpha_foreground_is_composited_over_background(self):
        pair = audit.Pair("test alpha foreground", "--fg", "--bg", 1.0)
        tokens = {"--fg": "rgba(255, 255, 255, .5)", "--bg": "#000000"}
        ratio = audit.render_pair(pair, tokens)
        self.assertGreater(ratio, 1.0)
        self.assertLess(ratio, 21.0)

    def test_alpha_background_requires_explicit_base(self):
        pair = audit.Pair("test missing base", "--fg", "--bg", 1.0)
        tokens = {"--fg": "#ffffff", "--bg": "rgba(0, 0, 0, .5)"}
        with self.assertRaises(AssertionError):
            audit.render_pair(pair, tokens)

    def test_alpha_background_composites_on_registered_base(self):
        pair = audit.Pair("test registered base", "--fg", "--bg", 1.0, "--base")
        tokens = {
            "--fg": "#ffffff",
            "--bg": "rgba(0, 0, 0, .5)",
            "--base": "#ffffff",
        }
        ratio = audit.render_pair(pair, tokens)
        self.assertGreater(ratio, 3.9)
        self.assertLess(ratio, 4.1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
