const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  doctorName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNo: { type: String, required: true },
  password: { type: String, required: true },
  patients: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Patient",
    default: [],
  },
});

const Doctor = mongoose.model("Doctor", doctorSchema);
module.exports = Doctor;
