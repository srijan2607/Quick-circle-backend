require("dotenv").config();
require("express-async-errors");

const express = require("express");
const app = express();
app.use(express.json());
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your frontend URL
    methods: ["GET", "POST"],
  },
});

// Store active polls and community users
const activePolls = {};
const communityUsers = new Map();

io.on("connection", (socket) => {
  // Get the user ID from the auth data
  const userId = socket.handshake.auth.userId || socket.id;
  console.log(`User connected: ${userId} (Socket ID: ${socket.id})`);

  // Handle community joining
  socket.on("joinCommunity", ({ communityId }) => {
    socket.join(communityId);

    // Initialize community users if not exists
    if (!communityUsers.has(communityId)) {
      communityUsers.set(communityId, new Set());
    }

    // Add user to community
    communityUsers.get(communityId).add(userId);

    // Notify others in the community
    socket.to(communityId).emit("userJoined", { userId });
    console.log(`User ${userId} joined community: ${communityId}`);
  });

  // Handle community leaving
  socket.on("leaveCommunity", ({ communityId }) => {
    socket.leave(communityId);

    if (communityUsers.has(communityId)) {
      communityUsers.get(communityId).delete(userId);
      socket.to(communityId).emit("userLeft", { userId });
    }
    console.log(`User ${userId} left community: ${communityId}`);
  });

  // Handle standard text/image messages
  socket.on("sendMessage", ({ communityId, message }) => {
    console.log(
      `Message received in community ${communityId} from ${socket.id}:`,
      message.type,
      message.content ? message.content.substring(0, 100) + "..." : "No content"
    );

    // Handle poll messages differently
    if (message.type === "poll") {
      try {
        const pollData = JSON.parse(message.content);
        const pollId = message.id;

        // Initialize poll if it doesn't exist
        if (!activePolls[pollId]) {
          activePolls[pollId] = {
            question: pollData.question,
            options: pollData.options,
            votes: pollData.options.map(() => 0),
            voters: new Set(),
            communityId: communityId,
          };
        }

        // Broadcast the poll to all clients
        socket.broadcast.to(communityId).emit("newMessage", {
          ...message,
          isSent: false, // Messages received by others should have isSent false
        });
        // Send back to sender with isSent true
        socket.emit("newMessage", {
          ...message,
          isSent: true,
        });
      } catch (error) {
        console.error("Error processing poll data:", error);
      }
    } else if (message.type === "cast_vote") {
      // Handle vote messages
      const { pollId, option, voterId } = message;

      if (activePolls[pollId]) {
        const poll = activePolls[pollId];

        // Check if user has already voted
        if (!poll.voters.has(voterId)) {
          // Update poll data
          poll.voters.add(voterId);
          poll.votes[option] += 1;

          // Calculate total votes
          const totalVotes = poll.votes.reduce((sum, count) => sum + count, 0);

          // Calculate percentages
          const percentages = poll.votes.map((vote) =>
            totalVotes > 0 ? Math.round((vote / totalVotes) * 100) : 0
          );

          // Create vote update message
          const voteUpdate = {
            type: "vote_update",
            pollId,
            votes: poll.votes,
            percentages,
            totalVoters: poll.voters.size,
            voterId,
            option,
          };

          // Log the update
          console.log("Broadcasting vote update:", voteUpdate);

          // Broadcast vote update to all clients
          io.to(communityId).emit("vote_update", voteUpdate);
        } else {
          console.log(`User ${voterId} has already voted in poll ${pollId}`);
        }
      }
    } else {
      // Handle regular messages (text, image, document)
      console.log(
        `Broadcasting ${message.type} message to community ${communityId}`
      );

      // Broadcast to others with isSent false
      socket.broadcast.to(communityId).emit("newMessage", {
        ...message,
        isSent: false,
      });

      // Send back to sender with isSent true
      socket.emit("newMessage", {
        ...message,
        isSent: true,
      });
    }
  });

  // Handle poll creation
  socket.on("create_poll", ({ communityId, pollId, pollData }) => {
    console.log(
      `Poll created in community ${communityId} by ${socket.id}:`,
      pollId
    );

    // Store the poll data for later updates
    try {
      if (pollData) {
        const parsedData = JSON.parse(pollData);
        activePolls[pollId] = {
          ...parsedData,
          votes: parsedData.options.map(() => 0), // Initialize votes array
          voters: new Set(), // Track who has voted
        };
        console.log(`Poll ${pollId} stored successfully`);
      }
    } catch (error) {
      console.error("Error parsing poll data:", error);
    }

    // Broadcast to all clients in the community
    io.to(communityId).emit("poll_update", { pollId, pollData });
  });

  // Handle document sharing
  socket.on("share_document", ({ communityId, documentName, documentData }) => {
    console.log(
      `Document shared in community ${communityId} by ${socket.id}:`,
      documentName
    );
    io.to(communityId).emit("document_shared", { documentName, documentData });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${userId}`);
    // Clean up user from all communities
    communityUsers.forEach((users, communityId) => {
      if (users.has(userId)) {
        users.delete(userId);
        io.to(communityId).emit("userLeft", { userId });
      }
    });
  });
});

// Endpoint to get active polls (optional, for debugging)
app.get("/api/active-polls", (req, res) => {
  res.json(activePolls);
});

// Endpoint to get community users (optional, for debugging)
app.get("/api/community-users", (req, res) => {
  const users = {};
  communityUsers.forEach((usersSet, communityId) => {
    users[communityId] = Array.from(usersSet);
  });
  res.json(users);
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
