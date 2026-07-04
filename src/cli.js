// Small CLI for manual operations:
//   node src/cli.js ingest   -> fetch feeds and queue pins
//   node src/cli.js boards   -> list Pinterest boards (needs OAuth done)
//   node src/cli.js tick     -> post the next due pin once
import { ingestAll } from "./ingest.js";
import { tick } from "./scheduler.js";
import { listBoards } from "./pinterest.js";
import { resetQueue } from "./db.js";

const cmd = process.argv[2];

async function main() {
  switch (cmd) {
    case "ingest": {
      const results = await ingestAll();
      console.log(JSON.stringify(results, null, 2));
      break;
    }
    case "boards": {
      const boards = await listBoards();
      for (const b of boards) console.log(`${b.id}\t${b.name}`);
      console.log(`\n${boards.length} board(s).`);
      break;
    }
    case "tick": {
      const result = await tick();
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "reset": {
      const cleared = resetQueue();
      console.log(`Cleared ${cleared.articles} articles and ${cleared.pins} pins.`);
      const results = await ingestAll();
      console.log(JSON.stringify(results, null, 2));
      break;
    }
    default:
      console.log("Usage: node src/cli.js [ingest|boards|tick|reset]");
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
