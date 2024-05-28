export class MockLocalStorage {
  private store: { [key: string]: string } = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    console.log('>>>> GET ITEM', key);
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    console.log('>>>> SET ITEM', key, value);
    this.store[key] = value;
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}
