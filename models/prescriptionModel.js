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
      name: { type: String, required: true },
      dosage: {
        timing: { type: String, required: true },
        amount: { type: String, required: true },
      },
    },
  ],
  description: { type: [String], default: [] },
});

const Prescription = mongoose.model("Prescription", prescriptionSchema);
module.exports = Prescription;
