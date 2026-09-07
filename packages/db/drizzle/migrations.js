// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_mushy_satana.sql';
import m0001 from './0001_long_firebrand.sql';
import m0002 from './0002_careful_sue_storm.sql';
import m0003 from './0003_normal_hairball.sql';
import m0004 from './0004_youthful_valkyrie.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004
    }
  }
  