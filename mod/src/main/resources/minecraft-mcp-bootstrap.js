(() => {
  const Context = Java.type('org.graalvm.polyglot.Context');
  const Source = Java.type('org.graalvm.polyglot.Source');
  const ctx = Context.getCurrent();
  ctx.eval(Source.newBuilder('js', event.getString('runtime'), 'mcp-runtime.js')
    .internal(true).buildLiteral());
  // A file-backed Source supplies structured locations without reading from disk.
  ctx.eval(Source.newBuilder('js', event.getObject('sourceFile'))
    .content(event.getString('code')).name(event.getString('scriptName')).buildLiteral());
})();
