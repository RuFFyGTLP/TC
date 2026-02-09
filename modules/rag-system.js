// ===============================
// RAG System - Retrieval Augmented Generation
// ===============================

const ragSystem = {
    documents: [],
    embeddings: new Map(),
    chunkSize: 500,
    overlapSize: 100
};

// ===============================
// Text Chunking
// ===============================
function chunkText(text, chunkSize = ragSystem.chunkSize, overlap = ragSystem.overlapSize) {
    const chunks = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            // Keep overlap from previous chunk
            const words = currentChunk.split(' ');
            currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence;
        } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

// ===============================
// Simple Embedding (TF-IDF style)
// ===============================
function createEmbedding(text) {
    const words = text.toLowerCase()
        .replace(/[^\w\sáéíóúüñ]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2);

    const wordFreq = new Map();
    for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // Normalize
    const maxFreq = Math.max(...wordFreq.values());
    for (const [word, freq] of wordFreq) {
        wordFreq.set(word, freq / maxFreq);
    }

    return wordFreq;
}

function cosineSimilarity(emb1, emb2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    const allWords = new Set([...emb1.keys(), ...emb2.keys()]);

    for (const word of allWords) {
        const v1 = emb1.get(word) || 0;
        const v2 = emb2.get(word) || 0;
        dotProduct += v1 * v2;
        norm1 += v1 * v1;
        norm2 += v2 * v2;
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// ===============================
// Document Indexing
// ===============================
async function indexDocument(content, metadata = {}) {
    const chunks = chunkText(content);
    const docs = [];

    for (let i = 0; i < chunks.length; i++) {
        const doc = {
            id: `${metadata.source || 'doc'}-${Date.now()}-${i}`,
            content: chunks[i],
            embedding: createEmbedding(chunks[i]),
            metadata: {
                ...metadata,
                chunkIndex: i,
                totalChunks: chunks.length
            },
            createdAt: new Date().toISOString()
        };

        ragSystem.documents.push(doc);
        ragSystem.embeddings.set(doc.id, doc.embedding);
        docs.push(doc);
    }

    // Save to IndexedDB if available
    if (typeof dbSave === 'function') {
        for (const doc of docs) {
            await dbSave('projectContext', {
                path: doc.id,
                type: 'chunk',
                content: doc.content,
                metadata: doc.metadata
            });
        }
    }

    console.log(`[RAG] Indexed ${chunks.length} chunks from ${metadata.source || 'document'}`);
    return docs;
}

// ===============================
// Semantic Search
// ===============================
function searchDocuments(query, topK = 5) {
    const queryEmbedding = createEmbedding(query);
    const scores = [];

    for (const doc of ragSystem.documents) {
        const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
        scores.push({ doc, similarity });
    }

    scores.sort((a, b) => b.similarity - a.similarity);
    return scores.slice(0, topK).filter(s => s.similarity > 0.1);
}

// ===============================
// Context Building for AI
// ===============================
function buildRAGContext(query, maxTokens = 2000) {
    const results = searchDocuments(query, 10);

    if (results.length === 0) {
        return '';
    }

    let context = '### Contexto Relevante:\n\n';
    let tokenCount = 0;

    for (const { doc, similarity } of results) {
        const chunkTokens = doc.content.split(/\s+/).length;
        if (tokenCount + chunkTokens > maxTokens) break;

        context += `**[${doc.metadata.source || 'Documento'}]** (relevancia: ${Math.round(similarity * 100)}%)\n`;
        context += doc.content + '\n\n';
        tokenCount += chunkTokens;
    }

    return context;
}

// ===============================
// File Indexing (for browser)
// ===============================
async function indexFile(file) {
    try {
        const content = await file.text();
        const metadata = {
            source: file.name,
            type: file.type,
            size: file.size,
            lastModified: new Date(file.lastModified).toISOString()
        };

        return await indexDocument(content, metadata);
    } catch (e) {
        console.error('[RAG] Error indexing file:', e);
        return null;
    }
}

// ===============================
// Project Analysis
// ===============================
async function analyzeProjectStructure() {
    // This would be enhanced with actual file system access
    const projectInfo = {
        name: state.settings.system?.projectName || 'Proyecto',
        workDir: state.settings.system?.workDir || '',
        tasks: state.tasks.length,
        agents: {
            orquestador: state.settings.orquestador?.enabled,
            implementador: state.settings.implementador?.enabled
        }
    };

    // Index project info
    await indexDocument(JSON.stringify(projectInfo, null, 2), {
        source: 'project-info',
        type: 'metadata'
    });

    return projectInfo;
}

// ===============================
// Enhanced AI Response with RAG
// ===============================
async function generateRAGResponse(userMessage) {
    // Get relevant context
    const context = buildRAGContext(userMessage);

    // Build enhanced prompt
    const enhancedMessage = context
        ? `${context}\n\n### Pregunta del Usuario:\n${userMessage}`
        : userMessage;

    // Use existing AI generation
    if (typeof generateAIResponse === 'function') {
        return await generateAIResponse(enhancedMessage);
    }

    return 'RAG habilitado pero sin proveedor de IA configurado';
}

// ===============================
// Clear and Reset
// ===============================
function clearRAGIndex() {
    ragSystem.documents = [];
    ragSystem.embeddings.clear();
    console.log('[RAG] Index cleared');
}

// Export for global access
window.ragSystem = ragSystem;
window.indexDocument = indexDocument;
window.indexFile = indexFile;
window.searchDocuments = searchDocuments;
window.buildRAGContext = buildRAGContext;
window.generateRAGResponse = generateRAGResponse;
window.analyzeProjectStructure = analyzeProjectStructure;
window.clearRAGIndex = clearRAGIndex;
