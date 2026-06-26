const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://osianhub:OsianPankaj@cluster0.hkystjh.mongodb.net/OsianHub?retryWrites=true&w=majority&appName=Cluster0";

const User = require('./models/User');
const Quiz = require('./models/Quiz');

const dummyQuizzes = [
    {
        title: "Web Design & Frontend Development",
        description: "Test your understanding of modern frontend technologies, CSS layouts, and DOM manipulation.",
        category: "technical",
        field: "Computer Science",
        difficulty: "easy",
        quizType: "practice",
        status: "active",
        duration: 15,
        price: 0,
        passingScore: 50,
        coverImage: "https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?auto=format&fit=crop&w=800&q=80",
        numQuestionsToShow: 5,
        visibility: "public",
        questions: [
            {
                questionText: "What is the difference between localStorage and sessionStorage?",
                questionType: "mcq",
                options: [
                    { text: "localStorage has a 1-day expiration, while sessionStorage lasts forever." },
                    { text: "localStorage data persists even after the browser is closed, while sessionStorage is cleared when the tab is closed." },
                    { text: "localStorage only stores strings, while sessionStorage can store native objects." },
                    { text: "There is no difference; they are aliases for the same storage object." }
                ],
                correctAnswer: 1,
                explanation: "localStorage data persists across browser sessions. sessionStorage data is cleared as soon as the tab or window is closed.",
                marks: 1
            },
            {
                questionText: "Which CSS property is used to create a grid container?",
                questionType: "mcq",
                options: [
                    { text: "display: flex;" },
                    { text: "grid-template: container;" },
                    { text: "display: grid;" },
                    { text: "align-items: stretch;" }
                ],
                correctAnswer: 2,
                explanation: "Setting 'display: grid' defines the element as a grid container and establishes a new grid formatting context.",
                marks: 1
            },
            {
                questionText: "What is the purpose of the semantic HTML5 <article> tag?",
                questionType: "mcq",
                options: [
                    { text: "To link to external newspaper articles." },
                    { text: "To represent a self-contained composition in a document that is independently distributable." },
                    { text: "To style text with a news-like layout." },
                    { text: "To declare a container for holding metadata." }
                ],
                correctAnswer: 1,
                explanation: "The <article> element represents a complete, self-contained block of content that makes sense on its own (e.g., blog post, product card).",
                marks: 1
            },
            {
                questionText: "Which of the following is correct about the async and defer attributes of script tags?",
                questionType: "mcq",
                options: [
                    { text: "Both block DOM parsing while loading the script." },
                    { text: "async executes scripts in order, while defer executes them as soon as they download." },
                    { text: "defer executes scripts in order after DOM parsing is complete, while async executes scripts immediately after download." },
                    { text: "defer can only be used with inline scripts." }
                ],
                correctAnswer: 2,
                explanation: "defer ensures the script runs in order of appearance after the DOM is fully parsed. async runs scripts asynchronously as soon as they finish loading.",
                marks: 1
            },
            {
                questionText: "What is the purpose of CSS media queries?",
                questionType: "mcq",
                options: [
                    { text: "To apply styles based on device characteristics like width, height, or resolution." },
                    { text: "To embed audio and video media files into stylesheet declarations." },
                    { text: "To send analytic queries about page visits to backend systems." },
                    { text: "To automatically compress CSS code for faster page loads." }
                ],
                correctAnswer: 0,
                explanation: "Media queries allow you to create responsive layouts by applying different styles based on screen width, height, aspect ratio, or resolution.",
                marks: 1
            }
        ]
    },
    {
        title: "Cybersecurity & Cryptography Fundamentals",
        description: "Dive into basic concepts of network security, ethical hacking, hashing, and encryption algorithms.",
        category: "technical",
        field: "Information Security",
        difficulty: "medium",
        quizType: "practice",
        status: "active",
        duration: 20,
        price: 0,
        passingScore: 50,
        coverImage: "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=800&q=80",
        numQuestionsToShow: 5,
        visibility: "public",
        questions: [
            {
                questionText: "What is the primary difference between symmetric and asymmetric encryption?",
                questionType: "mcq",
                options: [
                    { text: "Symmetric encryption uses two keys, while asymmetric uses one key." },
                    { text: "Symmetric encryption uses the same key for encryption and decryption, while asymmetric uses public and private key pairs." },
                    { text: "Symmetric encryption is only used for files, while asymmetric is used for networks." },
                    { text: "Symmetric encryption is slower than asymmetric encryption." }
                ],
                correctAnswer: 1,
                explanation: "Symmetric key cryptography uses a single shared secret key. Asymmetric key cryptography uses a public key for encryption and a matching private key for decryption.",
                marks: 1
            },
            {
                questionText: "Which of the following is a secure hashing algorithm commonly used for password storage?",
                questionType: "mcq",
                options: [
                    { text: "MD5" },
                    { text: "SHA-1" },
                    { text: "bcrypt" },
                    { text: "ROT13" }
                ],
                correctAnswer: 2,
                explanation: "bcrypt is specifically designed for password hashing, using a configurable work factor (rounds) to stay secure against brute-force attacks.",
                marks: 1
            },
            {
                questionText: "What is a 'Salt' in the context of hashing passwords?",
                questionType: "mcq",
                options: [
                    { text: "A secret key stored in the hardware security module." },
                    { text: "Random data added to the password input before hashing to protect against rainbow table attacks." },
                    { text: "A method to encrypt the database connection string." },
                    { text: "An algorithm to compress hashed outputs." }
                ],
                correctAnswer: 1,
                explanation: "Salting ensures that even identical passwords produce unique hashes. It protects against pre-computed rainbow table attacks.",
                marks: 1
            },
            {
                questionText: "What does SQL Injection (SQLi) refer to?",
                questionType: "mcq",
                options: [
                    { text: "Injecting malicious SQL databases into cloud servers." },
                    { text: "Running parallel SQL queries to increase processing speed." },
                    { text: "Inserting malicious SQL queries into input fields to manipulate backend databases." },
                    { text: "A hardware attack that compromises database servers." }
                ],
                correctAnswer: 2,
                explanation: "SQL injection occurs when attackers inject malicious SQL statements into inputs, which are then improperly parsed and executed by the backend database.",
                marks: 1
            },
            {
                questionText: "What is the purpose of a firewall?",
                questionType: "mcq",
                options: [
                    { text: "To extinguish hardware fires in server rooms." },
                    { text: "To encrypt all hard drives in the network." },
                    { text: "To monitor and control incoming/outgoing network traffic based on security rules." },
                    { text: "To backup database files automatically." }
                ],
                correctAnswer: 2,
                explanation: "A firewall filters network packets, shielding internal private networks from external threats by blocking unauthorized access.",
                marks: 1
            }
        ]
    },
    {
        title: "Indian Constitution & Contract Act",
        description: "Test your knowledge of the Indian Constitution, fundamental rights, and legal contract principles.",
        category: "law",
        field: "Legal Studies",
        difficulty: "hard",
        quizType: "practice",
        status: "active",
        duration: 15,
        price: 0,
        passingScore: 60,
        coverImage: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
        numQuestionsToShow: 5,
        visibility: "public",
        questions: [
            {
                questionText: "Under the Indian Contract Act, 1872, what makes an agreement voidable?",
                questionType: "mcq",
                options: [
                    { text: "If it is entered into by two competent parties." },
                    { text: "If consent was obtained by coercion, undue influence, fraud, or misrepresentation." },
                    { text: "If it lacks a written registration." },
                    { text: "If the consideration is of low monetary value." }
                ],
                correctAnswer: 1,
                explanation: "According to Section 19 of the Act, an agreement is a contract voidable at the option of the party whose consent was caused by coercion, fraud, or misrepresentation.",
                marks: 1
            },
            {
                questionText: "Which Article of the Indian Constitution guarantees the Right to constitutional remedies?",
                questionType: "mcq",
                options: [
                    { text: "Article 14" },
                    { text: "Article 19" },
                    { text: "Article 21" },
                    { text: "Article 32" }
                ],
                correctAnswer: 3,
                explanation: "Article 32 gives citizens the right to move the Supreme Court for enforcement of fundamental rights, described by Dr. B.R. Ambedkar as the 'heart and soul' of the Constitution.",
                marks: 1
            },
            {
                questionText: "An agreement with a minor in India is considered:",
                questionType: "mcq",
                options: [
                    { text: "Valid at the option of the minor." },
                    { text: "Voidable at the option of the guardian." },
                    { text: "Void ab initio (void from the beginning)." },
                    { text: "Valid if backed by high monetary consideration." }
                ],
                correctAnswer: 2,
                explanation: "In the landmark Mohori Bibee v. Dharmodas Ghose (1903) case, the Privy Council declared that a minor's agreement is void ab initio.",
                marks: 1
            },
            {
                questionText: "What does the legal term 'Consensus ad idem' mean?",
                questionType: "mcq",
                options: [
                    { text: "A contract must have consideration." },
                    { text: "Meeting of minds - agreeing upon the same thing in the same sense." },
                    { text: "An agreement to perform an illegal act." },
                    { text: "A dispute resolution process." }
                ],
                correctAnswer: 1,
                explanation: "Section 13 of the Indian Contract Act states that two or more persons are said to consent when they agree upon the same thing in the same sense (consensus ad idem).",
                marks: 1
            },
            {
                questionText: "Who is the custodian of the Constitution of India?",
                questionType: "mcq",
                options: [
                    { text: "The President of India" },
                    { text: "The Prime Minister of India" },
                    { text: "The Supreme Court of India" },
                    { text: "The Parliament of India" }
                ],
                correctAnswer: 2,
                explanation: "The Supreme Court of India is the ultimate interpreter and guardian/custodian of the Constitution and holds judicial review powers.",
                marks: 1
            }
        ]
    },
    {
        title: "Astrophysics & Space Exploration",
        description: "Journey through space, astrophysics, planetary motions, and the history of universe exploration.",
        category: "gk",
        field: "Space Science",
        difficulty: "easy",
        quizType: "practice",
        status: "active",
        duration: 10,
        price: 0,
        passingScore: 50,
        coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
        numQuestionsToShow: 5,
        visibility: "public",
        questions: [
            {
                questionText: "What is the boundary surrounding a black hole beyond which nothing, not even light, can escape?",
                questionType: "mcq",
                options: [
                    { text: "Singularity" },
                    { text: "Event Horizon" },
                    { text: "Accretion Disk" },
                    { text: "Schwarzschild Radius" }
                ],
                correctAnswer: 1,
                explanation: "The Event Horizon is the 'point of no return' surrounding a black hole where the escape velocity exceeds the speed of light.",
                marks: 1
            },
            {
                questionText: "Approximately how long does it take for light from the Sun to reach the Earth?",
                questionType: "mcq",
                options: [
                    { text: "8 seconds" },
                    { text: "3 minutes" },
                    { text: "8 minutes" },
                    { text: "24 hours" }
                ],
                correctAnswer: 2,
                explanation: "Light travels at ~300,000 km/s. The Sun is ~150 million km away, taking light approximately 8 minutes and 20 seconds to reach Earth.",
                marks: 1
            },
            {
                questionText: "Which planet in our solar system has the most prominent ring system?",
                questionType: "mcq",
                options: [
                    { text: "Jupiter" },
                    { text: "Saturn" },
                    { text: "Uranus" },
                    { text: "Neptune" }
                ],
                correctAnswer: 1,
                explanation: "While other gas giants have faint rings, Saturn has the most extensive, bright, and visually stunning ring system.",
                marks: 1
            },
            {
                questionText: "What is a light-year a unit of?",
                questionType: "mcq",
                options: [
                    { text: "Time" },
                    { text: "Distance" },
                    { text: "Speed" },
                    { text: "Brightness" }
                ],
                correctAnswer: 1,
                explanation: "A light-year is the distance that light travels in a vacuum in one Earth year, approximately 9.46 trillion kilometers.",
                marks: 1
            },
            {
                questionText: "What is the name of the first artificial satellite launched into space?",
                questionType: "mcq",
                options: [
                    { text: "Apollo 11" },
                    { text: "Voyager 1" },
                    { text: "Sputnik 1" },
                    { text: "Hubble" }
                ],
                correctAnswer: 2,
                explanation: "Sputnik 1 was launched by the Soviet Union on October 4, 1957, initiating the global Space Age.",
                marks: 1
            }
        ]
    },
    {
        title: "Sports Science & Global Athletics",
        description: "Test your knowledge of the Olympics, athlete physiology, sports rules, and legendary milestones.",
        category: "sports",
        field: "Physical Education",
        difficulty: "medium",
        quizType: "practice",
        status: "active",
        duration: 12,
        price: 0,
        passingScore: 50,
        coverImage: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80",
        numQuestionsToShow: 5,
        visibility: "public",
        questions: [
            {
                questionText: "How many rings are on the Olympic flag?",
                questionType: "mcq",
                options: [
                    { text: "4" },
                    { text: "5" },
                    { text: "6" },
                    { text: "7" }
                ],
                correctAnswer: 1,
                explanation: "The Olympic flag has five interlocking rings (blue, yellow, black, green, and red) representing the five inhabited continents.",
                marks: 1
            },
            {
                questionText: "What is the main source of energy for high-intensity, short-duration athletic events like sprinting?",
                questionType: "mcq",
                options: [
                    { text: "Aerobic respiration" },
                    { text: "Anaerobic ATP-PCr system" },
                    { text: "Fat oxidation" },
                    { text: "Protein synthesis" }
                ],
                correctAnswer: 1,
                explanation: "The phosphagen system (ATP-PCr) supplies immediate energy anaerobically for maximum effort events lasting 10-15 seconds.",
                marks: 1
            },
            {
                questionText: "In tennis, what term describes a score of 40-40?",
                questionType: "mcq",
                options: [
                    { text: "Love" },
                    { text: "Let" },
                    { text: "Deuce" },
                    { text: "Tiebreak" }
                ],
                correctAnswer: 2,
                explanation: "A score of 40-40 in a tennis game is called 'Deuce', meaning a player must win two consecutive points to win the game.",
                marks: 1
            },
            {
                questionText: "Which athlete holds the world record for the 100-meter and 200-meter sprint?",
                questionType: "mcq",
                options: [
                    { text: "Carl Lewis" },
                    { text: "Tyson Gay" },
                    { text: "Usain Bolt" },
                    { text: "Yohan Blake" }
                ],
                correctAnswer: 2,
                explanation: "Usain Bolt holds the 100m world record at 9.58s and the 200m record at 19.19s, both set in Berlin in 2009.",
                marks: 1
            },
            {
                questionText: "How long is a standard Olympic swimming pool?",
                questionType: "mcq",
                options: [
                    { text: "25 meters" },
                    { text: "50 meters" },
                    { text: "75 meters" },
                    { text: "100 meters" }
                ],
                correctAnswer: 1,
                explanation: "A standard Olympic competition pool is exactly 50 meters long, commonly referred to as 'long course'.",
                marks: 1
            }
        ]
    }
];

async function seed() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully!");

        // 1. Get or create admin user
        let admin = await User.findOne({ role: 'superadmin' }) || await User.findOne({ role: 'admin' });
        if (!admin) {
            console.log("No admin found. Creating default admin...");
            admin = new User({
                name: "Osian Hub Admin",
                email: "admin@osianhub.com",
                password: "osianadmin123", // Hashes on save pre hook
                role: "superadmin",
                isVerified: true,
                isApproved: true
            });
            await admin.save();
            console.log("Created admin user: admin@osianhub.com / osianadmin123");
        } else {
            console.log(`Using existing admin: ${admin.email}`);
        }

        // 2. Get or create regular user for convenience
        let user = await User.findOne({ role: 'user' });
        if (!user) {
            console.log("No regular user found. Creating default user...");
            user = new User({
                name: "Osian Demo User",
                email: "user@osianhub.com",
                password: "osianuser123", // Hashes on save pre hook
                role: "user",
                isVerified: true,
                isApproved: true
            });
            await user.save();
            console.log("Created default user: user@osianhub.com / osianuser123");
        } else {
            console.log(`Using existing user: ${user.email}`);
        }

        // 3. Insert Quizzes (clean up old ones first with same title)
        const quizTitles = dummyQuizzes.map(q => q.title);
        const deleteRes = await Quiz.deleteMany({ title: { $in: quizTitles } });
        console.log(`Cleaned up ${deleteRes.deletedCount} existing versions of dummy quizzes.`);

        const quizzesToInsert = dummyQuizzes.map(q => ({
            ...q,
            createdBy: admin._id
        }));

        const insertRes = await Quiz.insertMany(quizzesToInsert);
        console.log(`Successfully seeded ${insertRes.length} dummy quizzes!`);

    } catch (err) {
        console.error("Seeding error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from database.");
    }
}

seed();
