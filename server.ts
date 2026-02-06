import fs from "node:fs";
import path from "node:path";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const DIST_DIR = path.join(import.meta.dirname, "dist");
const RESOURCE_URI = "ui://color-palette/mcp-app.html";

export const createServer = (): McpServer => {
  const server = new McpServer({
    name: "Color Palette Generator",
    version: "1.0.0",
  });

  registerAppTool(
    server,
    "generate-palette",
    {
      title: "Generate Color Palette",
      description:
        "Generate a color palette from a base color using various color harmony rules (complementary, analogous, triadic, monochromatic, split-complementary).",
      inputSchema: {
        baseColor: z
          .string()
          .describe('Base color in hex format (e.g. "#3498db")'),
        paletteType: z
          .enum([
            "complementary",
            "analogous",
            "triadic",
            "monochromatic",
            "split-complementary",
          ])
          .describe("Type of color palette to generate"),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ baseColor, paletteType }) => {
      const colors = generatePalette(baseColor, paletteType);
      const result = { baseColor, paletteType, colors };
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  registerAppTool(
    server,
    "check-contrast",
    {
      title: "Check Contrast Ratio",
      description:
        "Check the contrast ratio between two colors and evaluate WCAG compliance levels.",
      inputSchema: {
        color1: z
          .string()
          .describe('First color in hex format (e.g. "#ffffff")'),
        color2: z
          .string()
          .describe('Second color in hex format (e.g. "#000000")'),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ color1, color2 }) => {
      const ratio = contrastRatio(color1, color2);
      const result = {
        color1,
        color2,
        ratio: Math.round(ratio * 100) / 100,
        wcag: {
          aaLarge: ratio >= 3,
          aa: ratio >= 4.5,
          aaa: ratio >= 7,
        },
      };
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.promises.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number): string => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToHsl = (hex: string): { h: number; s: number; l: number } | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const hslToHex = (h: number, s: number, l: number): string => {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
};

const luminance = (r: number, g: number, b: number): number => {
  const toLinear = (c: number): number => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const contrastRatio = (hex1: string, hex2: string): number => {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;

  const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
};

const generatePalette = (
  baseColor: string,
  type: string,
): { hex: string; name: string; role: string }[] => {
  const hsl = hexToHsl(baseColor);
  if (!hsl) return [];

  const { h, s, l } = hsl;

  const shiftHue = (degrees: number): number => (h + degrees + 360) % 360;

  switch (type) {
    case "complementary":
      return [
        { hex: baseColor, name: "Base", role: "Primary color" },
        {
          hex: hslToHex(shiftHue(180), s, l),
          name: "Complement",
          role: "Complementary accent",
        },
      ];

    case "analogous":
      return [
        {
          hex: hslToHex(shiftHue(-30), s, l),
          name: "Analogous Left",
          role: "Supporting color",
        },
        { hex: baseColor, name: "Base", role: "Primary color" },
        {
          hex: hslToHex(shiftHue(30), s, l),
          name: "Analogous Right",
          role: "Supporting color",
        },
      ];

    case "triadic":
      return [
        { hex: baseColor, name: "Base", role: "Primary color" },
        {
          hex: hslToHex(shiftHue(120), s, l),
          name: "Triadic 2",
          role: "Secondary accent",
        },
        {
          hex: hslToHex(shiftHue(240), s, l),
          name: "Triadic 3",
          role: "Tertiary accent",
        },
      ];

    case "monochromatic":
      return [
        {
          hex: hslToHex(h, s, Math.max(0, l - 30)),
          name: "Darkest",
          role: "Deep shade",
        },
        {
          hex: hslToHex(h, s, Math.max(0, l - 15)),
          name: "Dark",
          role: "Shade",
        },
        { hex: baseColor, name: "Base", role: "Primary color" },
        {
          hex: hslToHex(h, s, Math.min(100, l + 15)),
          name: "Light",
          role: "Tint",
        },
        {
          hex: hslToHex(h, s, Math.min(100, l + 30)),
          name: "Lightest",
          role: "Highlight",
        },
      ];

    case "split-complementary":
      return [
        { hex: baseColor, name: "Base", role: "Primary color" },
        {
          hex: hslToHex(shiftHue(150), s, l),
          name: "Split 1",
          role: "Accent color",
        },
        {
          hex: hslToHex(shiftHue(210), s, l),
          name: "Split 2",
          role: "Accent color",
        },
      ];

    default:
      return [{ hex: baseColor, name: "Base", role: "Primary color" }];
  }
};
