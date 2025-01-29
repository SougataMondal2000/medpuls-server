const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema({
  patientDetails: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  doctorDetails: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  medicines: [
    {
      drug: { type: String, required: true },
      dose: { type: String, required: true },
      frequency: { type: String, required: true },
      day: { type: String, required: true },
      remarks: { type: String, required: true },
    },
  ],
  tests: [{ type: String, required: true }],
  description: { type: [String], default: [] },
});

const Prescription = mongoose.model("Prescription", prescriptionSchema);
module.exports = Prescription;
