const { sequelize } = require("../models");

async function syncDatabase() {
  try {
    let connected = false;
    for (let attempt = 1; attempt <= 60; attempt += 1) {
      try {
        await sequelize.authenticate();
        connected = true;
        break;
      } catch (error) {
        if (attempt === 60) throw error;
        console.log(`Waiting for database (${attempt}/60)...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    if (!connected) throw new Error("Database connection timed out.");

    await sequelize.sync();
    console.log("Database tables are ready.");
  } catch (error) {
    console.error("Database synchronization failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

syncDatabase();
