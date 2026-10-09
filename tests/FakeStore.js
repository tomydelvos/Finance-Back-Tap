// Store di memori yang memenuhi kontrak `store` dari rencana (pengganti SheetStore).
class FakeStore {
  constructor({ kunci, kategori, transaksi }) {
    this._kunci = kunci;
    this._kategori = kategori;
    this._awal = transaksi || [];
    this.baris = [];
  }
  kunci() { return this._kunci; }
  kategori() { return this._kategori; }
  adaId(id) { return this.transaksi().some((b) => b[0] === id); }
  tambah(baris) { this.baris.push(baris); }
  transaksi() { return this._awal.concat(this.baris); }
  denganKunci(fn) { return fn(); }
}
module.exports = { FakeStore };
