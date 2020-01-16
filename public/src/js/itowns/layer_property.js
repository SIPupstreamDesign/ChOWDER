/**
 * Copyright (c) 2016-2018 Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * Copyright (c) 2016-2018 RIKEN Center for Computational Science. All rights reserved.
 */
"use strict";

class LayerProperty extends EventEmitter {
    constructor(store, action) {
        super();

        this.store = store;
        this.action = action;
    }

    
}

export default LayerProperty;
