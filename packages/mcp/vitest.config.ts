import { vitestPreset } from "@te/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(vitestPreset, defineConfig({}));
