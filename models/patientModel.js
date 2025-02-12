const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: {
    addressLine1: { type: String },
    addressLine2: { type: String },
    pincode: { type: String, required: true },
    city: { type: String },
    state: { type: String },
  },
  age: { type: Number, required: true },
  sex: { type: String, required: true },
  phone: { type: String, required: true },
  mail: { type: String },
  guardianName: { type: String },
  height: { type: String },
  weight: { type: String },
  pulse: { type: String },
  bp: { type: String },
  medicalHistory: { type: [String], default: [] },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
  },
  previousPrescriptions: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Prescription",
    default: [],
  },
});

const Patient = mongoose.model("Patient", patientSchema);
module.exports = Patient;
