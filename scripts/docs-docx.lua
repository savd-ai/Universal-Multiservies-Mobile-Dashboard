-- Pandoc filter for the Word versions of docs/*.md (used by scripts/docs-docx.mjs):
-- links to a sibling .md point at the .docx next to it, a paragraph holding only a screenshot is centred
-- ("Screenshot" style) and the italic "Hình N." / "Figure N." line under it becomes its caption ("Screenshot Caption").

function Link(el)
  local target = el.target
  if not target:match("^%a[%w+.-]*:") and not target:match("^#") then
    el.target = target:gsub("^docx/", ""):gsub("%.md#.*$", ".docx"):gsub("%.md$", ".docx")
  end
  return el
end

function Para(el)
  local only = #el.content == 1 and el.content[1]
  if only and only.t == "Image" then
    return pandoc.Div(el, { ["custom-style"] = "Screenshot" })
  end
  if only and only.t == "Emph" and (pandoc.utils.stringify(only):match("^Hình %d") or pandoc.utils.stringify(only):match("^Figure %d")) then
    return pandoc.Div(pandoc.Para(only.content), { ["custom-style"] = "Screenshot Caption" })
  end
end
