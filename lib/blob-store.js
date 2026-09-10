import { get, put, del, BlobPreconditionFailedError } from '@vercel/blob';

const options = { access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60 };
export const blobStore = {
  async read(pathname) {
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result) return null;
    return { value: await new Response(result.stream).json(), etag: result.blob.etag };
  },
  async create(pathname, value) {
    try {
      await put(pathname, JSON.stringify(value), { ...options, allowOverwrite: false });
      return true;
    } catch (error) {
      // Handles duplicate names and an acknowledged write whose response was lost.
      if (await this.read(pathname)) return false;
      throw error;
    }
  },
  async replace(pathname, value, etag) {
    try {
      await put(pathname, JSON.stringify(value), { ...options, allowOverwrite: true, ifMatch: etag });
      return true;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) return false;
      throw error;
    }
  },
  async remove(pathname, etag) {
    await del(pathname, { ifMatch: etag });
  },
};
