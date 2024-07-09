import { assert } from 'chai';
import * as Demo from '../src/Demo';

describe('Demo', () =>
{
    it('does', () => assert.strictEqual(typeof Demo.getDomElement, 'function') );
});
