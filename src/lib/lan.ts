import { networkInterfaces } from "node:os";

/**
 * This computer's addresses on the local network (e.g. 192.168.178.114), so
 * a phone on the same Wi-Fi can open the dev server. Development only: the
 * published site never uses these.
 */
export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
}
