/**
 * MongoDB Atlas Universal Adapter for Medsos Agent
 * 
 * Provides a high-performance MongoDB driver client with full Firestore-like
 * API compatibility (collection, doc, where, orderBy, limit, get, set, update, FieldValue.increment, batch).
 */

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

let client = null;
let database = null;

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || '';
const DB_NAME = process.env.MONGODB_DB_NAME || 'medsos_agent';

function generateDocId() {
  return crypto.randomBytes(10).toString('hex');
}

/**
 * Inisialisasi koneksi MongoDB dengan Connection Pooling
 */
async function getDb() {
  if (database) return database;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }

  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 8000,
    });
    await client.connect();
    console.log(`[MongoDB] Connected successfully to cluster (DB: ${DB_NAME})`);
  }

  database = client.db(DB_NAME);
  return database;
}

// FieldValue Helper
const FieldValue = {
  increment: (val = 1) => ({ __is_mongo_inc__: true, val: Number(val) || 1 }),
  serverTimestamp: () => new Date().toISOString(),
  delete: () => ({ __is_mongo_del__: true }),
};

/**
 * Format document from MongoDB (_id mapped to id)
 */
function formatFromMongo(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

/**
 * Parse update payload and handle FieldValue.increment & dot notation
 */
function prepareMongoUpdate(data, isMerge = false) {
  const setPayload = {};
  const incPayload = {};
  const unsetPayload = {};

  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val === 'object' && val.__is_mongo_inc__) {
      incPayload[key] = val.val;
    } else if (val && typeof val === 'object' && val.__is_mongo_del__) {
      unsetPayload[key] = "";
    } else {
      setPayload[key] = val;
    }
  }

  const update = {};
  if (Object.keys(setPayload).length > 0) update.$set = setPayload;
  if (Object.keys(incPayload).length > 0) update.$inc = incPayload;
  if (Object.keys(unsetPayload).length > 0) update.$unset = unsetPayload;

  return update;
}

/**
 * Document Reference Wrapper
 */
class DocRef {
  constructor(collectionName, id) {
    this.collectionName = collectionName;
    this.id = String(id || generateDocId());
  }

  async get() {
    const db = await getDb();
    const doc = await db.collection(this.collectionName).findOne({ _id: this.id });
    const formatted = formatFromMongo(doc);

    return {
      id: this.id,
      exists: Boolean(doc),
      data: () => formatted ? { ...formatted } : undefined,
      ref: this,
    };
  }

  async set(data, options = {}) {
    const db = await getDb();
    const isMerge = Boolean(options && options.merge);
    const cleanedData = { ...data, _id: this.id };
    delete cleanedData.id;

    if (isMerge) {
      const update = prepareMongoUpdate(cleanedData, true);
      await db.collection(this.collectionName).updateOne(
        { _id: this.id },
        update,
        { upsert: true }
      );
    } else {
      await db.collection(this.collectionName).replaceOne(
        { _id: this.id },
        cleanedData,
        { upsert: true }
      );
    }
    return { id: this.id };
  }

  async update(data) {
    const db = await getDb();
    const update = prepareMongoUpdate(data);
    await db.collection(this.collectionName).updateOne(
      { _id: this.id },
      update,
      { upsert: false }
    );
    return { id: this.id };
  }

  async delete() {
    const db = await getDb();
    await db.collection(this.collectionName).deleteOne({ _id: this.id });
    return { success: true };
  }
}

/**
 * Query Builder Wrapper
 */
class QueryBuilder {
  constructor(collectionName, conditions = [], sorts = [], limitVal = null) {
    this.collectionName = collectionName;
    this.conditions = conditions;
    this.sorts = sorts;
    this.limitVal = limitVal;
  }

  where(field, op, val) {
    return new QueryBuilder(
      this.collectionName,
      [...this.conditions, { field, op, val }],
      this.sorts,
      this.limitVal
    );
  }

  orderBy(field, dir = 'asc') {
    return new QueryBuilder(
      this.collectionName,
      this.conditions,
      [...this.sorts, { field, dir }],
      this.limitVal
    );
  }

  limit(n) {
    return new QueryBuilder(
      this.collectionName,
      this.conditions,
      this.sorts,
      parseInt(n, 10) || null
    );
  }

  buildMongoQuery() {
    const mongoQuery = {};

    for (const { field, op, val } of this.conditions) {
      const queryKey = field === 'id' ? '_id' : field;

      if (op === '==' || op === '===') {
        mongoQuery[queryKey] = val;
      } else if (op === 'in') {
        mongoQuery[queryKey] = { $in: Array.isArray(val) ? val : [val] };
      } else if (op === '>=') {
        mongoQuery[queryKey] = { ...(mongoQuery[queryKey] || {}), $gte: val };
      } else if (op === '<=') {
        mongoQuery[queryKey] = { ...(mongoQuery[queryKey] || {}), $lte: val };
      } else if (op === '>') {
        mongoQuery[queryKey] = { ...(mongoQuery[queryKey] || {}), $gt: val };
      } else if (op === '<') {
        mongoQuery[queryKey] = { ...(mongoQuery[queryKey] || {}), $lt: val };
      } else if (op === '!=') {
        mongoQuery[queryKey] = { $ne: val };
      } else if (op === 'array-contains') {
        mongoQuery[queryKey] = val;
      } else if (op === 'array-contains-any') {
        mongoQuery[queryKey] = { $in: Array.isArray(val) ? val : [val] };
      }
    }

    return mongoQuery;
  }

  async get() {
    const db = await getDb();
    const filter = this.buildMongoQuery();
    let cursor = db.collection(this.collectionName).find(filter);

    if (this.sorts.length > 0) {
      const sortObj = {};
      this.sorts.forEach(s => {
        const key = s.field === 'id' ? '_id' : s.field;
        sortObj[key] = s.dir === 'desc' ? -1 : 1;
      });
      cursor = cursor.sort(sortObj);
    }

    if (this.limitVal && this.limitVal > 0) {
      cursor = cursor.limit(this.limitVal);
    }

    const items = await cursor.toArray();
    const docs = items.map(item => {
      const formatted = formatFromMongo(item);
      return {
        id: formatted.id,
        exists: true,
        data: () => ({ ...formatted }),
        ref: new DocRef(this.collectionName, formatted.id),
      };
    });

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs,
      forEach: (cb) => docs.forEach(cb),
    };
  }
}

/**
 * Collection Reference Wrapper
 */
class CollectionRef extends QueryBuilder {
  constructor(collectionName) {
    super(collectionName);
  }

  doc(id) {
    return new DocRef(this.collectionName, id);
  }

  async add(data) {
    const id = data.id || generateDocId();
    const docRef = this.doc(id);
    await docRef.set(data);
    return docRef;
  }
}

/**
 * Batch Writer Wrapper
 */
class BatchWriter {
  constructor() {
    this.ops = [];
  }

  set(docRef, data, options = {}) {
    this.ops.push({ type: 'set', docRef, data, options });
    return this;
  }

  update(docRef, data) {
    this.ops.push({ type: 'update', docRef, data });
    return this;
  }

  delete(docRef) {
    this.ops.push({ type: 'delete', docRef });
    return this;
  }

  async commit() {
    if (this.ops.length === 0) return;

    // Kelompokkan per collection
    const byCol = {};
    for (const op of this.ops) {
      const colName = op.docRef.collectionName;
      if (!byCol[colName]) byCol[colName] = [];

      const docId = op.docRef.id;
      if (op.type === 'set') {
        const cleaned = { ...op.data, _id: docId };
        delete cleaned.id;
        if (op.options?.merge) {
          const update = prepareMongoUpdate(cleaned, true);
          byCol[colName].push({
            updateOne: { filter: { _id: docId }, update, upsert: true }
          });
        } else {
          byCol[colName].push({
            replaceOne: { filter: { _id: docId }, replacement: cleaned, upsert: true }
          });
        }
      } else if (op.type === 'update') {
        const update = prepareMongoUpdate(op.data);
        byCol[colName].push({
          updateOne: { filter: { _id: docId }, update, upsert: false }
        });
      } else if (op.type === 'delete') {
        byCol[colName].push({
          deleteOne: { filter: { _id: docId } }
        });
      }
    }

    const db = await getDb();
    for (const [colName, bulkOps] of Object.entries(byCol)) {
      if (bulkOps.length > 0) {
        await db.collection(colName).bulkWrite(bulkOps);
      }
    }
  }
}

// Database Main Object
const mongoDb = {
  collection: (name) => new CollectionRef(name),
  batch: () => new BatchWriter(),
};

module.exports = {
  mongoDb,
  FieldValue,
  getDb,
  isMongoConfigured: () => Boolean(process.env.MONGODB_URI || process.env.MONGO_URL),
};
