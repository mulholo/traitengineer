import { registerDeviceSchema, type Device, type RegisterDevice } from "@te/contracts";
import { NotFoundError } from "../errors.ts";
import type { DeviceRecord } from "../repositories.ts";
import { parseOrThrow } from "../validate.ts";
import type { ServiceDeps } from "./context.ts";

export type DeviceService = ReturnType<typeof createDeviceService>;

/** Public shape: the push token itself is never returned. */
export function toDevice({ expoPushToken: _token, ...d }: DeviceRecord): Device {
  return d;
}

export function createDeviceService({ repos, now }: ServiceDeps) {
  return {
    /** Upsert by push token (called on every app start). */
    async register(userId: string, input: RegisterDevice): Promise<Device> {
      const data = parseOrThrow(registerDeviceSchema, input, "device");
      return toDevice(await repos.devices.upsert(userId, data, now().toISOString()));
    },
    async list(userId: string): Promise<Device[]> {
      return (await repos.devices.list(userId)).map(toDevice);
    },
    async remove(userId: string, id: string): Promise<void> {
      if (!(await repos.devices.disable(userId, id, now().toISOString())))
        throw new NotFoundError("Device", id);
    },
  };
}
