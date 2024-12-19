import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createPool } from 'mysql2/promise';
import { format } from 'date-fns-tz';


const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Configure MySQL connection
const pool = createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'sia',
});

// Endpoint to save photo
// app.post('/api/photos', async (req, res) => {
//   const { image } = req.body;

//   if (!image) {
//     return res.status(400).send('Image data is required.');
//   }

//   try {
//     const result = await pool.query('INSERT INTO photos (image) VALUES (?)', [image]);
//     res.status(200).send({ message: 'Photo saved successfully!', id: result[0].insertId });
//   } catch (error) {
//     console.error('Error saving photo:', error);
//     res.status(500).send('Failed to save photo.');
//   }
// });


// app.get('/api/photos', async (req, res) => {
//     try {
//       const [rows] = await pool.query('SELECT id, image FROM photos');
//       res.status(200).json(rows);
//     } catch (error) {
//       console.error('Error fetching photos:', error);
//       res.status(500).send('Failed to fetch photos.');
//     }
//   });

  app.get('/api/students', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT id, name, student_id, section, email, phone, address, photo FROM students');
      res.status(200).json(rows);
    } catch (error) {
      console.error('Error fetching students:', error);
      res.status(500).send('Failed to fetch students.');
    }
  });

  app.post('/api/attendance', async (req, res) => {
    const { studentId, photo, date } = req.body;
  
    if (!studentId) {
      return res.status(400).send('Student ID is required.');
    }
  
    try {
      console.log("Request body:", req.body);
  
      // Define the timezone
      const timeZone = 'Asia/Shanghai'; 
      const now = new Date();
      const formattedTimestamp = format(now, 'yyyy-MM-dd HH:mm:ss', { timeZone });
      const formattedDate = format(new Date(date), 'yyyy-MM-dd', { timeZone });
  
      // Update the attendance record in the database
      const [result] = await pool.query(
        `UPDATE attendance 
         SET time_in = ?, status = ?, photo = ?
         WHERE student_id = ? AND attendance_date = ?`,
        [
          formattedTimestamp, // time_in
          'PRESENT',          // status
          photo,              // photo
          studentId,          // student_id
          formattedDate       // attendance_date
        ]
      );
  
      // Check if any rows were affected
      if (result.affectedRows === 0) {
        return res.status(404).send({ message: "No matching attendance record found to update." });
      }
  
      res.status(200).send({ message: "Attendance updated successfully!" });
    } catch (error) {
      console.error("Error updating attendance:", error);
      res.status(500).send("Failed to update attendance.");
    }
  });
  
 
  app.get('/api/attendance', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM attendance');
      
      // Convert attendance_date to ISO format
      const formattedRows = rows.map((row) => ({
        ...row,
        attendance_date: new Date(row.attendance_date).toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })

      }));
  
      res.status(200).json(formattedRows);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      res.status(500).send('Failed to fetch attendance.');
    }
  });

  
  app.post("/api/start-attendance", async (req, res) => {
    try {
      const { section, type, start_time, end_time, subject_id } = req.body;
  
      // Fetch all students
      const [students] = await pool.query("SELECT id FROM students");
  
      // Prepare attendance records
      const attendanceRecords = students.map((student) => [
        student.id,
        new Date(), // attendance_date (today's date)
        section,
        "", // time_in left blank
        "ABSENT", // Default status
        subject_id,
        type,
        start_time,
        end_time,
        "", // photo left blank
      ]);
  
      // Bulk insert attendance records
      const insertQuery = `
        INSERT INTO attendance 
        (student_id, attendance_date, section, time_in, status, subject_id, type, start_time, end_time, photo)
        VALUES ?
      `;
      await pool.query(insertQuery, [attendanceRecords]);
  
      return res.status(200).json({ message: "Attendance started successfully" });
    } catch (error) {
      console.error("Error starting attendance:", error);
      res.status(500).json({ error: "An error occurred while starting attendance." });
    }
  });



  app.get("/api/attendance/monthly", async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          MONTHNAME(attendance_date) AS month,
          COUNT(*) AS attendance_count
        FROM attendance
        GROUP BY MONTH(attendance_date)
        ORDER BY MONTH(attendance_date);
      `);
  
      const months = rows.map(row => row.month);
      const attendance = rows.map(row => row.attendance_count);
  
      res.json({ months, attendance });
    } catch (error) {
      console.error("Error fetching monthly attendance data:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/attendance/overview", async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT 
          status,
          COUNT(*) AS count
        FROM attendance
        GROUP BY status;
      `);
  
      const attendanceBreakdown = rows.map(row => row.count);
  
      res.json({
        attendanceBreakdown,
      });
    } catch (error) {
      console.error("Error fetching attendance overview data:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const [[{ totalStudents }]] = await pool.query(`SELECT COUNT(*) AS totalStudents FROM students;`);
      const [[{ totalClasses }]] = await pool.query(`SELECT COUNT(*) AS totalClasses FROM classes;`);
      const [[{ totalAttendanceEntries }]] = await pool.query(`SELECT COUNT(*) AS totalAttendanceEntries FROM attendance;`);
      const [[{ totalPresentEntries }]] = await pool.query(`SELECT COUNT(*) AS totalPresentEntries FROM attendance WHERE status = 'PRESENT';`);
  
      const attendanceRate = totalAttendanceEntries > 0 
        ? (totalPresentEntries / totalAttendanceEntries) * 100 
        : 0;
  
      res.json({
        totalStudents,
        totalClasses,
        attendanceRate: attendanceRate.toFixed(1)  // Format as a percentage with two decimal places
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.delete('/api/attendance/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      // Check if the record exists
      const [record] = await pool.query('SELECT * FROM attendance WHERE id = ?', [id]);
      if (record.length === 0) {
        return res.status(404).json({ message: 'Attendance record not found.' });
      }
  
      // Delete the record
      await pool.query('DELETE FROM attendance WHERE id = ?', [id]);
      res.status(200).json({ message: 'Attendance record deleted successfully.' });
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      res.status(500).json({ error: 'Failed to delete attendance record.' });
    }
  });
  



  // Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
  