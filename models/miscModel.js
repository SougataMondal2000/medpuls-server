const mongoose = require("mongoose");

const miscSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ["drug", "dose", "frequency", "day", "remarks", "test"],
    required: true,
  },
});

const Misc = mongoose.model("Misc", miscSchema);
module.exports = Misc;
