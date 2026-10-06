const babel = require('@babel/core');

module.exports = function renderingAreaLoader(source) {
    let transformed = false;
    const result = babel.transformSync(source, {
        configFile: false,
        babelrc: false,
        sourceMaps: false,
        plugins: [function renderingAreaPlugin({ types }) {
            return {
                visitor: {
                    ClassMethod(methodPath) {
                        const method = methodPath.node;
                        if (!types.isIdentifier(method.key, { name: 'resize' })) {
                            return;
                        }
                        const statements = method.body.body;
                        const allocationIndex = statements.findIndex((statement) => {
                            return types.isExpressionStatement(statement)
                                && types.isAssignmentExpression(statement.expression)
                                && types.isMemberExpression(statement.expression.left)
                                && types.isPrivateName(statement.expression.left.property)
                                && statement.expression.left.property.id.name === 'fullSizeDepthBuffer';
                        });
                        if (allocationIndex < 0) {
                            return;
                        }
                        const allocation = statements[allocationIndex];
                        const resize = statements[allocationIndex + 1];
                        if (!types.isExpressionStatement(resize)
                            || !types.isCallExpression(resize.expression)
                            || !types.isMemberExpression(resize.expression.callee)
                            || !types.isIdentifier(resize.expression.callee.property, { name: 'onWindowResize' })) {
                            throw new Error('Unsupported iTowns View.resize source');
                        }
                        const renderingMethod = types.cloneNode(method, true);
                        renderingMethod.key = types.identifier('resizeRenderingArea');
                        renderingMethod.body.body = statements.slice(0, allocationIndex + 2).map((statement) => {
                            return types.cloneNode(statement, true);
                        });
                        renderingMethod.body.body.push(types.expressionStatement(types.assignmentExpression(
                            '=',
                            types.memberExpression(types.cloneNode(allocation.expression.left, true), types.identifier('needsUpdate')),
                            types.booleanLiteral(true),
                        )));
                        statements.splice(allocationIndex, 2, types.expressionStatement(types.callExpression(
                            types.memberExpression(types.thisExpression(), types.identifier('resizeRenderingArea')),
                            [types.identifier('width'), types.identifier('height')],
                        )));
                        methodPath.insertBefore(renderingMethod);
                        transformed = true;
                    },
                },
            };
        }],
    });
    if (!transformed || result === null || typeof result.code !== 'string') {
        throw new Error('iTowns 2.44.2 View rendering-area transformation failed');
    }
    return result.code;
};