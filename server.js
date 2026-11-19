const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const SECRET_KEY = "hospital_project_secret";

const readUsers = () => {
    return JSON.parse(fs.readFileSync("./users.json", "utf8"));
};

app.get("/", (req, res) => {
    res.send("Hospital Appointment System Backend is Running!");
});

// Login API
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const users = readUsers();

        const user = users.find(
            (u) => u.email === email
        );

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        let passwordMatch;

        if (user.password.startsWith("$2")) {
            passwordMatch = await bcrypt.compare(
                password,
                user.password
            );
        } else {
            passwordMatch = password === user.password;
        }

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Convert sample password into a secure hash
        if (!user.password.startsWith("$2")) {
            user.password = await bcrypt.hash(user.password, 10);

            fs.writeFileSync(
                "./users.json",
                JSON.stringify(users, null, 2)
            );
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                doctorId: user.doctorId



            },
            SECRET_KEY,
            { expiresIn: "1d" }
        );

        res.json({
            message: "Login successful",
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                doctorId: user.doctorId
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
});
// Verify login token
function verifyToken(req, res, next) {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({
            message: "Access denied. Please login."
        });
    }

    try {
        const decoded = jwt.verify(
            token.replace("Bearer ", ""),
            SECRET_KEY
        );

        req.user = decoded;
        next();

    } catch (error) {
        res.status(401).json({
            message: "Invalid token"
        });
    }
}

// Allow Admin only
function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access only"
        });
    }

    next();
}

// Allow Doctor only
function doctorOnly(req, res, next) {
    if (req.user.role !== "doctor") {
        return res.status(403).json({
            message: "Doctor access only"
        });
    }

    next();
}
// Admin Dashboard API
app.get("/api/admin/dashboard", verifyToken, adminOnly, (req, res) => {
    const doctors = JSON.parse(
        fs.readFileSync("./doctors.json", "utf8")
    );

    const appointments = JSON.parse(
        fs.readFileSync("./appointments.json", "utf8")
    );

    res.json({
        totalDoctors: doctors.length,
        totalAppointments: appointments.length,
        pendingAppointments: appointments.filter(
            a => a.status === "Pending"
        ).length
    });
});
// Doctor Profile API
app.get("/api/doctor/profile", verifyToken, doctorOnly, (req, res) => {
    const doctors = JSON.parse(
        fs.readFileSync("./doctors.json", "utf8")
    );

    const doctor = doctors.find(
        d => d.id === req.user.doctorId
    );

    if (!doctor) {
        return res.status(404).json({
            message: "Doctor not found"
        });
    }

    res.json(doctor);
});
// Update Doctor Availability
app.patch("/api/doctor/availability", verifyToken, doctorOnly, (req, res) => {
    const doctors = JSON.parse(
        fs.readFileSync("./doctors.json", "utf8")
    );

    const doctor = doctors.find(
        d => d.id === req.user.doctorId
    );

    if (!doctor) {
        return res.status(404).json({
            message: "Doctor not found"
        });
    }

    doctor.availability = req.body.availability;

    fs.writeFileSync(
        "./doctors.json",
        JSON.stringify(doctors, null, 2)
    );

    res.json({
        message: "Availability updated successfully",
        doctor
    });
});
// Admin - View All Doctors
app.get("/api/admin/doctors", verifyToken, adminOnly, (req, res) => {
    const doctors = JSON.parse(
        fs.readFileSync("./doctors.json", "utf8")
    );

    res.json(doctors);
});
// Admin - Add Doctor
app.post("/api/admin/doctors", verifyToken, adminOnly, (req, res) => {
    const doctors = JSON.parse(
        fs.readFileSync("./doctors.json", "utf8")
    );

    const { name, specialization, qualification, experience, contact } = req.body;

    if (!name || !specialization) {
        return res.status(400).json({
            message: "Name and specialization are required"
        });
    }

    const newDoctor = {
        id: Date.now(),
        name,
        specialization,
        qualification,
        experience,
        contact,
        availability: true
    };

    doctors.push(newDoctor);

    fs.writeFileSync(
        "./doctors.json",
        JSON.stringify(doctors, null, 2)
    );

    res.status(201).json({
        message: "Doctor added successfully",
        doctor: newDoctor
    });
});
// Admin - Edit Doctor
app.put("/api/admin/doctors/:id", verifyToken, adminOnly, (req, res) => {
    const doctors = JSON.parse(
        fs.readFileSync("./doctors.json", "utf8")
    );

    const doctor = doctors.find(
        d => d.id === Number(req.params.id)
    );

    if (!doctor) {
        return res.status(404).json({
            message: "Doctor not found"
        });
    }

    Object.assign(doctor, req.body);

    fs.writeFileSync(
        "./doctors.json",
        JSON.stringify(doctors, null, 2)
    );

    res.json({
        message: "Doctor updated successfully",
        doctor
    });
});
// Admin - Delete Doctor
app.delete("/api/admin/doctors/:id", verifyToken, adminOnly, (req, res) => {
    let doctors = JSON.parse(
        fs.readFileSync("./doctors.json", "utf8")
    );

    const doctorId = Number(req.params.id);

    const doctorExists = doctors.some(
        d => d.id === doctorId
    );

    if (!doctorExists) {
        return res.status(404).json({
            message: "Doctor not found"
        });
    }

    doctors = doctors.filter(
        d => d.id !== doctorId
    );

    fs.writeFileSync(
        "./doctors.json",
        JSON.stringify(doctors, null, 2)
    );

    res.json({
        message: "Doctor deleted successfully"
    });
});
// Admin - View All Appointments
app.get("/api/admin/appointments", verifyToken, adminOnly, (req, res) => {
    const appointments = JSON.parse(
        fs.readFileSync("./appointments.json", "utf8")
    );

    res.json(appointments);
});
// Doctor - View My Appointments
app.get("/api/doctor/appointments", verifyToken, doctorOnly, (req, res) => {
    const appointments = JSON.parse(
        fs.readFileSync("./appointments.json", "utf8")
    );

    const myAppointments = appointments.filter(
        a => a.doctorId === req.user.doctorId
    );

    res.json(myAppointments);
});
// Doctor - Update Appointment Status
app.patch("/api/doctor/appointments/:id/status", verifyToken, doctorOnly, (req, res) => {
    const appointments = JSON.parse(
        fs.readFileSync("./appointments.json", "utf8")
    );

    const appointment = appointments.find(
        a => a.id === Number(req.params.id) &&
             a.doctorId === req.user.doctorId
    );

    if (!appointment) {
        return res.status(404).json({
            message: "Appointment not found"
        });
    }

    const { status } = req.body;

    if (!["Approved", "Rejected"].includes(status)) {
        return res.status(400).json({
            message: "Invalid appointment status"
        });
    }

    appointment.status = status;

    fs.writeFileSync(
        "./appointments.json",
        JSON.stringify(appointments, null, 2)
    );

    res.json({
        message: "Appointment status updated successfully",
        appointment
    });
});
// Admin - Update Appointment Status
app.patch("/api/admin/appointments/:id/status", verifyToken, adminOnly, (req, res) => {
    const appointments = JSON.parse(
        fs.readFileSync("./appointments.json", "utf8")
    );

    const appointment = appointments.find(
        a => a.id === Number(req.params.id)
    );

    if (!appointment) {
        return res.status(404).json({
            message: "Appointment not found"
        });
    }

    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected", "Completed"].includes(status)) {
        return res.status(400).json({
            message: "Invalid appointment status"
        });
    }

    appointment.status = status;

    fs.writeFileSync(
        "./appointments.json",
        JSON.stringify(appointments, null, 2)
    );

    res.json({
        message: "Appointment status updated successfully",
        appointment
    });
});
// Create New Appointment
app.post("/api/appointments", (req, res) => {
    const appointments = JSON.parse(
        fs.readFileSync("./appointments.json", "utf8")
    );

    const { patientName, doctorId, date, time, reason } = req.body;

    if (!patientName || !doctorId || !date || !time) {
        return res.status(400).json({
            message: "Please provide all required details"
        });
    }

    const newAppointment = {
        id: Date.now(),
        patientName,
        doctorId: Number(doctorId),
        date,
        time,
        reason: reason || "",
        status: "Pending"
    };

    appointments.push(newAppointment);

    fs.writeFileSync(
        "./appointments.json",
        JSON.stringify(appointments, null, 2)
    );

    res.status(201).json({
        message: "Appointment created successfully",
        appointment: newAppointment
    });
});
const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});