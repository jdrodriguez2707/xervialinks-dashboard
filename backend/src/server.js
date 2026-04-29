const app = require("./app");
const env = require("./infrastructure/config/env");

app.listen(env.port, () => {
  console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
});
