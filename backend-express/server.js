import app from "./src/app.js";
import connectDB from "./src/config/database.js";
import config from "./src/config/config.js";

import dns from "dns"; 
dns.setServers(['8.8.8.8', '1.1.1.1']);

connectDB();

app.listen(config.PORT, () => {
  console.log(`server is listening on port ${config.PORT}.`);
});
