const fs = require("fs");
const h = fs.readFileSync("/tmp/h.html", "utf8");
console.log("home date inputs", (h.match(/type="date"/g) || []).length);
console.log("home 開催日", h.split("開催日").length - 1);
console.log("home RaceDayBar/picker ok", h.includes("開催日") && h.includes('type="date"'));
