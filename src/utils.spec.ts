import fs from "fs/promises";
import { installGoodKey } from "./utils";

async function main() {
    await fs.mkdir(`temp`, { recursive: true });
    try {
        await installGoodKey(`${__dirname}/../dist`, `temp`);
    }
    finally {
        await fs.rm(`temp`, { recursive: true });
    }
}

main().catch(console.error);