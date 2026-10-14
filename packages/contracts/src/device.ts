import { z } from "zod";
import { idSchema, timestampSchema } from "./common.ts";

export const platformSchema = z.enum(["ios", "android", "web"]);

export const deviceSchema = z
  .object({
    id: idSchema,
    platform: platformSchema,
    deviceName: z.string(),
    lastSeenAt: timestampSchema,
    disabledAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .meta({ id: "Device" });
export type Device = z.infer<typeof deviceSchema>;

export const registerDeviceSchema = z
  .object({
    expoPushToken: z
      .string()
      .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, "Must be an Expo push token")
      .meta({ example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }),
    platform: platformSchema,
    deviceName: z.string().trim().max(100).default(""),
  })
  .meta({ id: "RegisterDevice" });
export type RegisterDevice = z.input<typeof registerDeviceSchema>;
